# Local Development

Two ways to run the full stack locally: Docker Compose (one command) or manual (three terminals).

Both require a `.env` file at the repo root with valid Azure credentials — see `backend/.env.example`.

---

## Option A: Docker Compose

```bash
cd infra
docker compose up --build
```

| Service | URL |
|---------|-----|
| Backend | http://localhost:8000 |
| Frontend | http://localhost:5173 |
| Function App | runs in background, listens on queue |

Hot reload is enabled — editing files in `backend/src/`, `frontend/src/`, or `functions/function_app.py` will pick up changes automatically.

To stop: `docker compose down`

---

## Option B: Manual (three terminals)

### Terminal 1 — Backend

```bash
cd backend
uv sync --dev
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Function App

```bash
cd functions
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
func start
```

Requires [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) (`func` CLI).

### Terminal 3 — Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

---

## Verify everything works

1. Health check: `curl http://localhost:8000/health`
2. Upload a sample dataset:
   ```bash
   curl -X POST http://localhost:8000/uploads/ \
     -F "file=@frontend/public/samples/tech-articles.csv;type=text/csv"
   ```
3. Create an experiment (use the `blob_name` from step 2):
   ```bash
   curl -X POST http://localhost:8000/experiments/ \
     -H "Content-Type: application/json" \
     -d '{"name": "test", "blob_name": "<blob_name>", "dataset_type": "csv"}'
   ```
4. Poll for results:
   ```bash
   curl http://localhost:8000/experiments/<id>
   ```
   Status goes `created` → `processing` → `completed`.

5. Or open http://localhost:5173/upload in the browser and use the UI.

---

## Sample datasets

Three sample CSV files are in `frontend/public/samples/`:

| File | Content |
|------|---------|
| `tech-articles.csv` | ML/AI concepts (transformers, backprop, CNNs) |
| `product-reviews.csv` | Consumer product descriptions |
| `news-headlines.csv` | News stories (climate, markets, space) |

Each has a `text` column with 5 rows.
