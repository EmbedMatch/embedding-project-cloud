# EmbedMatch — Embedding Model Benchmarking Platform

Upload your data, pick constraints, and let Azure cloud infrastructure tell you which embedding model performs best on **your** specific dataset.

## Architecture

```
User Browser
    │
    ├─ React SPA (Azure App Service: embed-match-web)
    │       │
    │       ▼
    ├─ FastAPI Backend (Azure App Service: embed-match-api)
    │       │
    │       ├─► Azure Blob Storage ──── user CSV/JSON datasets
    │       ├─► Azure Cosmos DB ──────── experiment state & results
    │       └─► Azure Storage Queue ──── benchmark-jobs queue
    │
    └─ Azure Function App (embed-benchmark-fn)  ◄── queue trigger
            │
            ├─ Downloads dataset from Blob Storage
            ├─ Generates queries via GPT-4o-mini
            ├─ Embeds documents with each selected model
            ├─ Cosine similarity → top-5 retrieval per query
            ├─ LLM judge (GPT-4o-mini) scores relevance 0–1
            └─ Writes results to Cosmos DB (status: "completed")
```

## Azure Services

| Service | Resource Name | Purpose |
|---------|--------------|---------|
| App Service (Python) | `embed-match-api` | FastAPI REST backend |
| App Service (Node) | `embed-match-web` | React SPA (static) |
| Blob Storage | `embedstorage20147` | User dataset uploads |
| Storage Queue | `embedstorage20147` | `benchmark-jobs` async queue |
| Cosmos DB (NoSQL) | `embed-cosmos` | Experiment persistence |
| Azure OpenAI | `embed-openai-sweden` | Embeddings + GPT-4o-mini judge |
| Function App | `embed-benchmark-fn` | Queue-triggered benchmark engine |

### Deployed Embedding Models (embed-openai-sweden, Sweden Central)

| Deployment Name | Model | Dimensions | Cost $/M tokens | MTEB Score |
|----------------|-------|-----------|----------------|------------|
| `text-embedding-ada-002` | Ada 002 | 1536 | $0.10 | 61.0 |
| `text-embedding-3-large` | Text Embedding 3 Large | 3072 | $0.13 | 64.6 |

## Live URLs

| Environment | URL |
|-------------|-----|
| Frontend | https://embed-match-web.azurewebsites.net |
| Backend API | https://embed-match-api.azurewebsites.net |
| API Docs | https://embed-match-api.azurewebsites.net/docs |

## Quickstart (Local Development)

### Prerequisites

- Python 3.12 + [uv](https://docs.astral.sh/uv/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Node.js 20+ + [pnpm](https://pnpm.io/) — `curl -fsSL https://get.pnpm.io/install.sh | sh`
- Docker & Docker Compose
- Azure CLI — `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`

### 1. Clone & Configure

```bash
git clone https://github.com/<org>/embedding-project
cd embedding-project
cp .env.example .env
# Fill in .env with your Azure credentials (see Environment Variables below)
```

### 2. Run Backend

```bash
cd backend
docker-compose up          # starts FastAPI on http://localhost:8000
```

Or without Docker:
```bash
cd backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

### 3. Run Frontend

```bash
cd frontend
pnpm install
pnpm dev                   # starts Vite dev server on http://localhost:5173
```

API docs available at http://localhost:8000/docs

## User Flow

1. **Upload** (`/upload`) — upload a CSV/JSON with a `text` column (or `document`)
2. **Constraints** (`/constraints`) — set max model size, max cost/M tokens, min MTEB score
3. **Leaderboard** (`/leaderboard`) — browse filtered models, select 1-2 to benchmark
4. **Results** (`/results`) — watch live status as Azure Function benchmarks each model
5. **Dashboard** (`/dashboard`) — view all past experiments and best scores

### Sample CSV Format

```csv
text
"Machine learning models require large amounts of training data to generalize well."
"Transformer architectures use self-attention mechanisms to process sequential data."
"Fine-tuning a pre-trained model is often more efficient than training from scratch."
```

The benchmark engine auto-detects the text column. Minimum 10 rows recommended.

## Project Structure

```
embedding-project/
├── backend/                    # FastAPI Python backend
│   ├── src/
│   │   ├── main.py             # App entry point, CORS, router registration
│   │   ├── config.py           # pydantic-settings (reads .env + Azure App Settings)
│   │   ├── models.py           # Pydantic schemas (Experiment, ModelResult, etc.)
│   │   ├── cosmos.py           # Cosmos DB client + container helpers
│   │   ├── queue.py            # Azure Storage Queue client
│   │   ├── storage.py          # Blob Storage client
│   │   └── routers/
│   │       ├── uploads.py      # POST /uploads/ → Blob Storage
│   │       ├── experiments.py  # CRUD + POST /experiments/{id}/benchmark
│   │       └── models_catalog.py  # GET /models/ with filtering
│   ├── pyproject.toml          # Dependencies (uv)
│   ├── requirements.txt        # Compiled deps for Azure App Service
│   └── docker-compose.yml      # Local dev container
│
├── functions/benchmark/        # Azure Function App
│   ├── function_app.py         # Queue-triggered benchmark engine
│   ├── requirements.txt        # Function dependencies
│   └── host.json               # Functions v4 runtime config
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── pages/              # Upload, Constraints, Leaderboard, Results, Dashboard
│   │   └── components/ui/      # shadcn/ui components
│   ├── public/samples/         # Downloadable sample datasets
│   └── package.json
│
├── .env.example                # Template for environment variables
└── .github/workflows/          # CI/CD pipelines
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where to find it |
|----------|-----------------|
| `AZURE_STORAGE_CONNECTION_STRING` | Storage Account → Access Keys |
| `AZURE_STORAGE_CONTAINER` | `uploads` (create if not exists) |
| `AZURE_COSMOS_CONNECTION_STRING` | Cosmos DB → Keys → Primary Connection String |
| `AZURE_COSMOS_DATABASE` | `embedbench` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI → Keys and Endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI → Keys and Endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini` |
| `CORS_ORIGINS` | `'["http://localhost:5173"]'` for local dev |

## Deployment

### CI/CD (GitHub Actions)

Push to `main` triggers:
- `deploy-backend.yml` — zips backend, deploys via Kudu to `embed-match-api`
- `deploy-frontend.yml` — builds Vite SPA, deploys static files to `embed-match-web`

### Manual Backend Deploy

```bash
cd backend
pip install -r requirements.txt  # or uv pip compile
cd ..
zip -r backend.zip backend/
az webapp deployment source config-zip \
  --name embed-match-api --resource-group EmbedMatch \
  --src backend.zip
```

### Manual Function Deploy

```bash
# Install func CLI
npm install -g azure-functions-core-tools@4

cd functions
func azure functionapp publish embed-benchmark-fn
```

## Key Cloud Design Decisions

**Why Azure Storage Queue for benchmarking?**
Benchmarking 2 models on 50 documents takes ~2 minutes (embedding + LLM judge). An HTTP request would time out. The queue decouples submission from execution — the API responds immediately with a job ID, and the Function processes asynchronously.

**Why LLM-as-judge instead of labeled datasets?**
Users upload their own unlabeled data. GPT-4o-mini generates evaluation queries and judges retrieval relevance, requiring zero manual annotation. This lets any text dataset work out of the box.

**Why Azure OpenAI for all ML workloads?**
Single service for both embedding models and the GPT-4o-mini judge. No extra credentials, consistent latency within the Azure network, and usage billed to one resource.

**Why Cosmos DB NoSQL?**
Experiment documents have variable schema (results array grows as models finish). Cosmos's schemaless JSON storage fits naturally; partition key `/id` gives direct single-document lookups for the polling endpoint.

**Why pydantic-settings for config?**
The same Settings class reads from `.env` locally and from Azure App Service Application Settings in production — no code changes between environments.
