# Changes Required for Deployment

Everything that had to be added or fixed to make the app deploy and run correctly on Azure.

---

## Backend

### `backend/requirements.txt` — Generated (new file)

**Problem:** Azure's Oryx build system installs Python packages from `requirements.txt`. Without it, the app deploys but crashes immediately with `No module named uvicorn`.

**Fix:**
```bash
uv pip compile pyproject.toml -o requirements.txt
```
This file must be included in the zip when deploying.

---

### `backend/src/config.py` — New file

**Problem:** The app needs Azure connection strings and CORS origins at runtime. Hardcoding them is insecure; the app also needs to find `.env` regardless of which directory it's launched from.

**Fix:** Created a `pydantic-settings` config that reads from both `backend/.env` and the project root `.env`:

```python
_ENV_FILES = (
    Path(__file__).parent.parent / ".env",        # backend/.env
    Path(__file__).parent.parent.parent / ".env", # project root .env
)
```

On Azure, these values come from App Settings (environment variables), which pydantic-settings reads automatically — no `.env` file needed in production.

---

### `backend/src/main.py` — Updated

**Problem 1:** CORS was hardcoded to `localhost:5173`, blocking all requests from the deployed frontend.

**Fix:** Read origins from config:
```python
allow_origins=settings.cors_origins,
```
Set `CORS_ORIGINS=["https://<frontend>.azurewebsites.net"]` in Azure App Settings.

**Problem 2:** The health check used invalid API parameters:
- `list_containers(max_results=1)` — `max_results` is not a valid kwarg
- `list_databases(max_item_count=1)` — same issue

**Fix:**
```python
blob_service.get_account_information()          # cheap account probe
next(iter(cosmos_client.list_databases()), None) # read one item, no params
```

---

### `backend/src/storage.py` and `cosmos.py` — New files

Azure SDK clients injected as FastAPI dependencies. The key bug fixed during development was in storage:

**Problem:** Passing `content_settings` as a plain dict raises `AttributeError: 'dict' object has no attribute 'cache_control'`.

**Fix:**
```python
from azure.storage.blob import ContentSettings
blob_client.upload_blob(data, content_settings=ContentSettings(content_type=content_type))
```

---

## Frontend

### `frontend/tsconfig.app.json` — Modified

**Problem:** The `@` path alias (`@/components/...`) was configured in Vite but not in TypeScript. `tsc` failed with `Cannot find module '@/...'` for every import, blocking the build entirely.

**Fix:** Added path mapping to `tsconfig.app.json`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

---

### `frontend/src/index.css` — Fixed config path

**Problem:** `@config "./tailwind.config.ts"` resolves relative to the CSS file (`src/`), but `tailwind.config.ts` is in `frontend/`. Build failed with `Can't resolve './tailwind.config.ts'`.

**Fix:**
```css
@config "../tailwind.config.ts";
```

---

### `frontend/src/pages/Leaderboard.tsx` — Fixed unused variable

**Problem:** `const [models, setModels] = useState(...)` — `setModels` was declared but never used. TypeScript strict mode (`noUnusedLocals`) treats this as an error, blocking the build.

**Fix:**
```ts
const [models] = useState(...)
```

---

### `frontend/.env.production` — New file

**Problem:** `VITE_API_URL` (the backend URL) must be known at build time — Vite bakes `VITE_*` variables into the JS bundle. Azure App Settings are runtime-only and arrive too late.

**Fix:** Created `frontend/.env.production`:
```
VITE_API_URL=https://embed-match-web-hfasa8feb5bxf3hw.switzerlandnorth-01.azurewebsites.net
```
Vite automatically picks this up during `pnpm build`.

---

## Azure Configuration

### Deployment method — Backend

**Problem:** `az webapp deploy` (OneDeploy) skips the Oryx build step. Files land in `wwwroot` but `pip install` never runs, so all packages are missing.

**Fix:** Use the older Kudu-based command instead:
```bash
az webapp deployment source config-zip \
  --resource-group EmbedMatch \
  --name embed-match-web \
  --src backend.zip
```
This triggers Oryx, which installs `requirements.txt` before starting the app.

---

### Startup command — Backend

**Problem:** Without an explicit startup command, Azure doesn't know how to run the FastAPI app.

**Fix:**
```
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```
Using `python -m uvicorn` (not just `uvicorn`) ensures the virtualenv's copy is used.

---

### Startup command — Frontend (SPA routing)

**Problem:** Deploying only the `dist/` static files means the server has no knowledge of React Router routes. Navigating directly to `/test` returns 404 because there's no `test` file on disk.

**Fix:** Use `serve` with the `-s` (single-page app) flag, which redirects all unknown paths to `index.html`:
```
npx serve . -s -l $PORT
```

---

### Cosmos DB firewall

**Problem:** Cosmos DB was configured with an IP allowlist. The App Service's outbound IP (`4.226.26.189`) was not in it, resulting in `Forbidden` errors.

**Pitfall:** `outboundIpAddresses` (~13 IPs) is the current active set. Azure can use any IP from the larger `possibleOutboundIpAddresses` pool (~31 IPs) at any time. Whitelisting only the current IPs causes intermittent failures.

**Fix:** Whitelist all IPs from `possibleOutboundIpAddresses`:
```bash
az webapp show --name embed-match-web --resource-group EmbedMatch \
  --query "possibleOutboundIpAddresses" -o tsv
# Then add all of them to Cosmos DB ip-range-filter
```

**Production alternative:** VNet integration — the App Service connects to Cosmos DB over a private network, no IP management needed.
