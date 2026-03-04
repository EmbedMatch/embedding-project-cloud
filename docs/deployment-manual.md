# Manual Deployment Guide — EmbedBench

This guide walks through deploying the backend (FastAPI) and frontend (React) to Azure App Service manually from the command line.

---

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in the connection strings:

```bash
cp .env.example .env
```

Get the Storage connection string:
```
Azure Portal → embedstorage20147 → Security + networking → Access keys → Connection string
```

Get the Cosmos DB connection string:
```
Azure Portal → embed-db → Settings → Keys → Primary Connection String
```

---

## Backend Deployment

### 1. Generate `requirements.txt`

Azure's Oryx builder uses `requirements.txt` to install Python packages.

```bash
cd backend
uv pip compile pyproject.toml -o requirements.txt
```

### 2. Configure Azure App Settings

Set connection strings and CORS as environment variables on the App Service:

```bash
az webapp config appsettings set \
  --name embed-match-web \
  --resource-group EmbedMatch \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=<your-storage-connection-string>" \
    "AZURE_COSMOS_CONNECTION_STRING=<your-cosmos-connection-string>" \
    'CORS_ORIGINS=["https://<frontend-hostname>.azurewebsites.net"]'
```

> **Why not `.env`?** On App Service, secrets go into App Settings (encrypted at rest). The app reads them as regular environment variables — pydantic-settings picks these up automatically.

### 3. Set startup command

```bash
az webapp config set \
  --name embed-match-web \
  --resource-group EmbedMatch \
  --startup-file "python -m uvicorn src.main:app --host 0.0.0.0 --port 8000"
```

> **Important:** Use `az webapp deployment source config-zip` (Kudu), NOT `az webapp deploy` (OneDeploy). OneDeploy skips the Oryx build step, which means `pip install` never runs and Python packages are missing.

### 4. Create and upload the zip

```bash
cd backend
zip -r ../backend.zip . \
  -x ".venv/*" \
  -x "__pycache__/*" \
  -x "*.pyc" \
  -x "uv.lock" \
  -x "tests/*"

az webapp deployment source config-zip \
  --resource-group EmbedMatch \
  --name embed-match-web \
  --src ../backend.zip
```

Wait ~60 seconds for the build to complete.

### 5. Verify

```bash
curl https://<backend-hostname>.azurewebsites.net/health
# Expected: {"version":"0.1.0","storage":"ok","cosmos":"ok","status":"healthy"}
```

If Cosmos DB returns `Forbidden`, add the App Service's outbound IPs to the Cosmos DB firewall:

```bash
# Get ALL possible outbound IPs (use possibleOutboundIpAddresses, not outboundIpAddresses)
OUTBOUND=$(az webapp show --name embed-match-web --resource-group EmbedMatch \
  --query "possibleOutboundIpAddresses" -o tsv)

# Get existing Cosmos DB IPs to preserve them
EXISTING="4.210.172.107,13.88.56.148,13.91.105.215,40.91.218.243"

az cosmosdb update \
  --name embed-db \
  --resource-group EmbedMatch \
  --ip-range-filter "${EXISTING},${OUTBOUND}"
```

> **Production note:** IP whitelisting is fragile — Azure can change the IP pool. Use VNet integration for a proper production setup.

---

## Frontend Deployment

### 1. Set the backend URL

Create `frontend/.env.production` with the deployed backend URL:

```bash
echo "VITE_API_URL=https://<backend-hostname>.azurewebsites.net" \
  > frontend/.env.production
```

> Vite bakes `VITE_*` variables into the bundle at build time. Azure App Settings won't work for these — they need to be in `.env.production` before the build.

### 2. Build

```bash
cd frontend
pnpm install
pnpm build
# Output is in frontend/dist/
```

### 3. Configure startup command

The frontend is a static SPA. We serve it with the `serve` npm package:

```bash
az webapp config set \
  --name embed-match-frontend \
  --resource-group EmbedMatch \
  --startup-file "npx serve . -s -l \$PORT"
```

- `-s` — SPA mode: unknown paths return `index.html` instead of 404 (required for React Router)
- `-l $PORT` — listen on the port Azure assigns (usually 8080)

### 4. Zip and deploy the dist folder

```bash
cd frontend/dist
zip -r ../../frontend.zip .

az webapp deploy \
  --name embed-match-frontend \
  --resource-group EmbedMatch \
  --src-path ../../frontend.zip \
  --type zip
```

> For the frontend (static files only), `az webapp deploy` (OneDeploy) is fine — there is no build step needed, the files are already built.

### 5. Verify

```bash
curl -s https://<frontend-hostname>.azurewebsites.net/test
# Should return the EmbedBench HTML page (check title tag)
```

Open in browser: `https://<frontend-hostname>.azurewebsites.net/test`

The page shows live status badges for backend, storage, and Cosmos DB, and a file upload test.

---

## Redeployment (after code changes)

### Backend
```bash
cd backend
uv pip compile pyproject.toml -o requirements.txt  # only if deps changed
zip -r ../backend.zip . -x ".venv/*" -x "__pycache__/*" -x "*.pyc" -x "uv.lock" -x "tests/*"
az webapp deployment source config-zip \
  --resource-group EmbedMatch --name embed-match-web --src ../backend.zip
```

### Frontend
```bash
cd frontend
pnpm build
cd dist && zip -r ../../frontend.zip .
az webapp deploy \
  --name embed-match-frontend --resource-group EmbedMatch \
  --src-path ../../frontend.zip --type zip
```

---

## Access Control (IP Restriction)

Both apps are restricted to a single allowed IP. Anyone else gets 403 Forbidden.

### Update your IP (when it changes)

Your home/office IP is dynamic and will change periodically. When it does, run:

```bash
NEW_IP=$(curl -s ifconfig.me)

az webapp config access-restriction remove --name embed-match-frontend --resource-group EmbedMatch --rule-name "allowed"
az webapp config access-restriction remove --name embed-match-web --resource-group EmbedMatch --rule-name "allowed"

az webapp config access-restriction add --name embed-match-frontend --resource-group EmbedMatch --rule-name "allowed" --action Allow --ip-address "$NEW_IP/32" --priority 100
az webapp config access-restriction add --name embed-match-web --resource-group EmbedMatch --rule-name "allowed" --action Allow --ip-address "$NEW_IP/32" --priority 100
```

### Add another person's IP

```bash
az webapp config access-restriction add --name embed-match-frontend --resource-group EmbedMatch --rule-name "person-name" --action Allow --ip-address "<their-ip>/32" --priority 200
az webapp config access-restriction add --name embed-match-web --resource-group EmbedMatch --rule-name "person-name" --action Allow --ip-address "<their-ip>/32" --priority 200
```

They can find their IP at [ifconfig.me](https://ifconfig.me).

### Remove someone's access

```bash
az webapp config access-restriction remove --name embed-match-frontend --resource-group EmbedMatch --rule-name "person-name"
az webapp config access-restriction remove --name embed-match-web --resource-group EmbedMatch --rule-name "person-name"
```

### View current rules

```bash
az webapp config access-restriction show --name embed-match-frontend --resource-group EmbedMatch --query "ipSecurityRestrictions[].{name:name,ip:ipAddress,action:action}" -o table
```

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Backend API | `https://embed-match-web-hfasa8feb5bxf3hw.switzerlandnorth-01.azurewebsites.net` |
| Backend health | `.../health` |
| Backend docs | `.../docs` |
| Frontend | `https://embed-match-frontend-dchgczcrajhba9cf.switzerlandnorth-01.azurewebsites.net` |
| Frontend test | `.../test` |

| Resource | Azure Resource Group |
|----------|----------------------|
| App Service Plan | `ASP-EmbedMatch-8d75` |
| Backend App Service | `embed-match-web` |
| Frontend App Service | `embed-match-frontend` |
| Storage Account | `embedstorage20147` |
| Cosmos DB | `embed-db` |
| Resource Group | `EmbedMatch` (Switzerland North) |
