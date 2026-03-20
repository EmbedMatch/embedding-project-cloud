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

## Sprint 1 — Foundation (weeks 1–2) ✅

Goal: all Azure services connected, file upload works end-to-end, CI/CD deploys on push.

| # | Task | SP | Owner | Status |
|---|------|----|-------|--------|
| 1.1 | Backend: Cosmos DB client + experiment CRUD | 5 | A | **done** |
| 1.2 | Backend: dataset parser (download blob + parse CSV/JSON) | 5 | A | **done** |
| 1.3 | Function App: scaffold `function_app.py` with queue trigger | 3 | B | **done** |
| 1.4 | Backend: simple LLM chat endpoint (`POST /chat/`) | 2 | B | **done** |
| 1.5 | Function App: embed texts with ada-002, return stats + placeholder score | 5 | C | **done** |
| 1.6 | Storage: Blob upload endpoint (`POST /uploads/`) | 3 | C | **done** |
| 1.7 | Storage: queue client with base64 encoding — auto-enqueue on experiment creation | 3 | C | **done** |
| 1.8 | Infra: GitHub Actions deploy workflows (backend, frontend, function) | 5 | C | **done** |
| 1.9 | Infra: App Service IP restrictions + Cosmos DB firewall | 2 | D | **done** |
| 1.10 | Infra: App Insights dashboard + failure alerts | 3 | D | **done** |
| 1.11 | Infra: frontend `.env.production` + tsconfig fix + verify build | 2 | C | **done** |
| 1.12 | Frontend: Upload page with sample datasets + Results page polling API | 3 | C | **done** |
| 1.13 | Testing: pytest + coverage setup with CI integration | 3 | C | **done** |

**Sprint 1 deliverable**: user uploads a CSV (or picks a sample), experiment is created in Cosmos, function embeds texts with ada-002, results appear on the frontend. ✅

**Also completed (unplanned):**
- Docker Compose for full local dev stack (backend + function + frontend with hot reload)
- Local dev documentation (`docs/local-dev.md`)
- 3 sample datasets (tech-articles, product-reviews, news-headlines — 10 texts each)

---

## Sprint 2 — Benchmarking engine (weeks 3–4)

Goal: multiple models compared side-by-side, LLM judge scores relevance, results dashboard.

**Context from Sprint 1:**
- Datasets are plain text (no query-document pairs) — the function must generate queries or use another evaluation strategy
- Relevance score is currently a random placeholder — LLM judge is the core Sprint 2 feature
- Function currently embeds with one model (ada-002) — Sprint 2 adds multi-model support
- Auto-enqueue already works — experiment creation sends to queue automatically

| # | Task | SP | Owner | Depends on |
|---|------|----|-------|------------|
| 2.1 | Function: LLM-generated queries — use GPT to create retrieval queries from each text, then score retrieval | 5 | Jay (B) | — |
| 2.2 | Function: LLM-as-judge — per-document relevance scoring (0–10 scale, temp=0, seed=42, JSON output) | 5 | Jay (B) | 2.1 |
| 2.3 | Function: add text-embedding-3-large as second Azure OpenAI model | 2 | Arzun (D) | — |
| 2.4 | Function: add open-source models via fastembed (ONNX Runtime) — MiniLM, BGE | 5 | Jay (B) | — |
| 2.5 | Function: compute metrics per model (relevance, latency, cost) and write results array to Cosmos | 3 | Sneha (A) | 2.2, 2.3 |
| 2.6 | Backend: experiment status + progress polling (% complete per model) | 3 | Sneha (A) | — |
| 2.7 | Backend: re-trigger experiment (reset status, clear old results, re-enqueue) | 2 | Sneha (A) | — |
| 2.8 | Backend: summary/recommendation endpoint — rank models by score | 3 | Sneha (A) | 2.5 |
| 2.9 | Function: progress tracking — update Cosmos per-model as benchmark runs | 3 | Janek (C) | 2.5 |
| 2.10 | Infra: Function App deploy with bundled `.python_packages` (fastembed + ONNX) | 5 | Janek (C) | 2.4 |
| 2.11 | Storage: poison queue handling — dead-letter detection, re-enqueue utility | 3 | Janek (C) | — |
| 2.12 | Backend: input validation hardening (file types, size limits, structured errors) | 3 | Arzun (D) | — |
| 2.13 | Testing: integration tests against deployed app (health, upload, benchmark, results) | 5 | Arzun (D) | 2.5 |
| 2.14 | Frontend: multi-model results dashboard, progress bar, comparison charts (vibecoded) | 5 | any | 2.5, 2.6 |

**Totals**: Sneha (A)=11 · Jay (B)=15 · Janek (C)=11 · Arzun (D)=10

**Sprint 2 deliverable**: user uploads data, 4+ models are benchmarked with LLM judge, results displayed with per-model scores/charts and a recommendation.

---

## Sprint 3 — Polish & presentation (weeks 5–6)

Goal: hardened platform, documentation complete, presentation ready.

| # | Task | SP | Owner | Depends on |
|---|------|----|-------|------------|
| 3.1 | Backend: structured logging (request IDs, timing) + error middleware | 3 | A | — |
| 3.2 | Backend: CORS tighten for production (only allow deployed frontend origin) | 1 | A | — |
| 3.3 | Testing: backend unit tests (Cosmos client, upload validation, queue) | 5 | A | — |
| 3.4 | Function: retry logic for transient OpenAI / network failures (exponential backoff) | 3 | B | — |
| 3.5 | Function: cost estimation model (token count × pricing per model) | 3 | B | — |
| 3.6 | Testing: function unit tests (dataset parsing, scoring, metric computation) | 5 | B | — |
| 3.7 | Infra: single deploy script for all 3 services | 3 | C | — |
| 3.8 | Infra: final security review (secrets rotation, CORS, firewall) | 2 | C | — |
| 3.9 | Docs: architecture diagram (PlantUML) matching final state | 3 | C | — |
| 3.10 | Testing: end-to-end test on deployed Azure environment | 5 | D | all |
| 3.11 | Docs: presentation slides (reveal.js or PowerPoint) | 5 | D + all | — |
| 3.12 | All: demo rehearsal + final cleanup | 2 | all | 3.10 |
| 3.13 | Frontend: final polish pass (vibecoded) | 2 | any | — |

**Totals**: A=9 · B=11 · C=8 · D=12

**Sprint 3 deliverable**: polished platform ready for demo, all tests passing, documentation and presentation complete.

---

## Workload Summary

| Member | Sprint 1 | Sprint 2 | Sprint 3 | Total |
|--------|----------|----------|----------|-------|
| A | 10 SP | 8 SP | 9 SP | **27 SP** |
| B | 10 SP | 20 SP | 11 SP | **41 SP** |
| C | 14 SP | 11 SP | 8 SP | **33 SP** |
| D | 7 SP | 8 SP | 12 SP | **27 SP** |

> **Note**: B is heavy in Sprint 2 (multi-model + LLM judge is the core feature). Consider A or D picking up 2.3 or 2.4 to balance.

| Member | Sprint 1 | Sprint 2 | Sprint 3 |
|--------|----------|----------|----------|
| A | Cosmos CRUD, dataset parser | Progress polling, re-trigger, recommendation | Logging, tests, production CORS |
| B | Function scaffold, LLM chat, ada-002 embedding | LLM queries, LLM judge, open-source models, metrics | Retry logic, cost model, tests |
| C | Blob upload, queue, deploy, env, frontend, testing | Progress tracking, fn deploy with packages, poison queue | Deploy script, security, arch diagram |
| D | IP restrictions, App Insights | Validation, integration tests | E2E testing, presentation |
