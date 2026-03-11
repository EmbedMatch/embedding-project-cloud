# EmbedBench — Sprint Plan

4 team members, 3 sprints (~2 weeks each). Story points on Fibonacci scale (1/2/3/5/8).

**Roles** (flexible — everyone touches everything, but each person owns an area):
- **A** — Backend API (FastAPI, Cosmos DB)
- **B** — Benchmark function (Azure Functions, embedding models, LLM judge)
- **C** — Storage/queue layer + CI/CD + deploy pipelines
- **D** — Infra/security + testing + docs

Frontend/UX is AI-assisted (vibecoding) — not assigned as a dedicated role.

---

## Already done

| # | Task | SP |
|---|------|----|
| 0.1 | Backend: config module (pydantic-settings, env loading, CORS from env) | 2 |
| 0.2 | Backend: health check probing Storage, Cosmos DB, and OpenAI (`GET /health`) | 3 |
| 0.3 | Infra: pre-commit hooks (ruff, mypy, eslint, tsc, gitleaks) + CI lint-on-PR workflow | 3 |
| 0.4 | Docs: cloud_config.md — Portal setup for all resources (step-by-step) | 3 |

---

## Sprint 1 — Foundation (weeks 1–2)

Goal: all Azure services connected, file upload works end-to-end, CI/CD deploys on push.

| # | Task | SP | Owner | Depends on |
|---|------|----|-------|------------|
| 1.1 | Backend: Cosmos DB client + experiment CRUD (`POST /experiments/`, `GET /experiments/{id}`, `GET /experiments/`) | 5 | A | — |
| 1.2 | Backend: read experiment from Cosmos + download blob + parse dataset (CSV/JSON) — shared module used by function | 5 | A | 1.1 |
| 1.3 | Function App: scaffold `function_app.py` with queue trigger (`benchmark-jobs`) | 3 | B | — |
| 1.4 | Backend: simple LLM chat endpoint (`POST /chat/`) — verify Azure OpenAI connectivity + test page | 2 | B | — |
| 1.5 | Function App: embed with Azure OpenAI (ada-002) + cosine similarity retrieval | 5 | B | 1.3, 1.2 |
| 1.6 | Storage: Blob upload endpoint (`POST /uploads/`, CSV/JSON/TXT, 50 MB limit, content-type detection) | 3 | C | — |
| 1.7 | Storage: queue client with base64 encoding — enqueue jobs on experiment creation | 3 | C | — |
| 1.8 | Infra: GitHub Actions deploy workflows (backend Kudu zip + frontend OneDeploy + Function zip) | 5 | C | — |
| 1.9 | Infra: App Service IP restrictions + Cosmos DB firewall (outbound IPs) | 2 | D | — |
| 1.10 | Infra: App Insights dashboard — query logs, set up failure alerts for function | 3 | D | — |
| 1.11 | Infra: frontend `.env.production` with `VITE_API_URL`, verify build works with prod backend | 2 | D | 1.8 |
| 1.12 | Frontend: connect Upload + Results pages to real API (vibecoded) | 3 | any | 1.1, 1.6 |

**Totals**: A=10 · B=10 · C=11 · D=7

**Sprint 1 deliverable**: user can upload a file, experiment is created in Cosmos, function processes it with ada-002, results appear on the frontend.

---

## Sprint 2 — Benchmarking engine (weeks 3–4)

Goal: multiple models compared side-by-side, LLM judge scores relevance, results dashboard works.

| # | Task | SP | Owner | Depends on |
|---|------|----|-------|------------|
| 2.1 | Backend: experiment status + progress polling endpoint (% complete per model) | 3 | A | 1.2 |
| 2.2 | Backend: re-trigger experiment (reset status, clear old results, re-enqueue) | 2 | A | 1.1, 1.7 |
| 2.3 | Backend: constraint selection on upload — user picks task type + model size/cost filters | 3 | A | 1.2 |
| 2.4 | Backend: summary/recommendation endpoint — rank models by score within user's constraints | 3 | A | 2.7 |
| 2.5 | Function: add open-source models via fastembed (ONNX Runtime) — MiniLM, BGE | 5 | B | 1.5 |
| 2.6 | Function: LLM-as-judge — per-document relevance scoring (0–10 scale, temp=0, seed=42, JSON output) | 5 | B | 1.5 |
| 2.7 | Function: compute metrics per model (relevance score, latency, cost estimate) → write to Cosmos | 3 | B | 2.6 |
| 2.8 | Function: progress tracking — update Cosmos per-model as benchmark runs | 3 | C | 2.7 |
| 2.9 | Storage: poison queue handling — dead-letter detection, re-enqueue utility | 3 | C | 1.7 |
| 2.10 | Infra: Function App deploy with bundled `.python_packages` (Docker-based pip install) | 5 | C | 2.5 |
| 2.11 | Function: add text-embedding-3-large as second Azure OpenAI model | 2 | D | 1.5 |
| 2.12 | Backend: input validation hardening (file types, size limits, structured error responses) | 3 | D | 1.6 |
| 2.13 | Testing: integration tests for backend API (upload, experiments, queue, health) | 5 | D | 2.1 |
| 2.14 | Frontend: dashboard, results charts, progress bar, sample datasets (vibecoded) | 5 | any | 2.1, 2.7 |

**Totals**: A=11 · B=13 · C=11 · D=10

**Sprint 2 deliverable**: user uploads data, picks constraints, 4+ models are benchmarked with LLM judge, results displayed with scores/charts and a recommendation.

---

## Sprint 3 — Polish & presentation (weeks 5–6)

Goal: hardened platform, documentation complete, presentation ready.

| # | Task | SP | Owner | Depends on |
|---|------|----|-------|------------|
| 3.1 | Backend: structured logging (request IDs, timing) + error middleware | 3 | A | — |
| 3.2 | Backend: `.env.example` with all required variables documented | 1 | A | — |
| 3.3 | Backend: CORS tighten for production (only allow deployed frontend origin) | 1 | A | — |
| 3.4 | Testing: backend unit tests (config, Cosmos client, upload validation) | 5 | A | — |
| 3.5 | Function: retry logic for transient OpenAI / network failures (exponential backoff) | 3 | B | — |
| 3.6 | Function: cost estimation model (token count × pricing per model) | 3 | B | — |
| 3.7 | Testing: function unit tests (dataset parsing, scoring, metric computation) | 5 | B | — |
| 3.8 | Infra: single deploy script for all 3 services | 3 | C | — |
| 3.9 | Infra: final security review (secrets rotation, CORS, firewall, publish profiles) | 2 | C | — |
| 3.10 | Docs: architecture diagram (PlantUML) matching final state | 3 | C | — |
| 3.11 | Testing: end-to-end test on deployed Azure environment (upload → benchmark → results) | 5 | D | all |
| 3.12 | Docs: presentation slides (reveal.js or PowerPoint) | 5 | D + all | — |
| 3.13 | All: demo rehearsal + final cleanup | 2 | all | 3.11 |
| 3.14 | Frontend: final polish pass (vibecoded) | 2 | any | — |

**Totals**: A=10 · B=11 · C=8 · D=12

**Sprint 3 deliverable**: polished platform ready for demo, all tests passing, documentation and presentation complete.

---

## Workload Summary

| Member | Sprint 1 | Sprint 2 | Sprint 3 | Total |
|--------|----------|----------|----------|-------|
| A | 10 SP | 11 SP | 10 SP | **31 SP** |
| B | 10 SP | 13 SP | 11 SP | **34 SP** |
| C | 11 SP | 11 SP | 8 SP | **30 SP** |
| D | 7 SP | 10 SP | 12 SP | **29 SP** |

| Member | Sprint 1 | Sprint 2 | Sprint 3 |
|--------|----------|----------|----------|
| A | Cosmos CRUD, dataset parser | Status polling, re-trigger, constraints, recommendation | Logging, tests, production CORS |
| B | Function scaffold, LLM chat test, ada-002 embedding | Open-source models, LLM judge, metrics | Retry logic, cost model, tests |
| C | Blob upload, queue, deploy workflows | Progress tracking, poison queue, fn deploy | Deploy script, security, arch diagram |
| D | IP restrictions, App Insights, frontend env | text-embedding-3-large, validation, integration tests | E2E testing, presentation |
