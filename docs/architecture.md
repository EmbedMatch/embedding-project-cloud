# System Architecture

> **EmbedMatch – Embedding Model Selection Platform**
> Final architecture as built for the Cloud Computing course project (POLIMI, 2025–26).

![Architecture Diagram](architecture.png)

---

## Diagram Source (Mermaid)

```mermaid
flowchart TD
    %% ── Styling ──────────────────────────────────────────────────────────────
    classDef azure   fill:#0072C6,color:#fff,stroke:#005A9E,rx:6
    classDef app     fill:#1A1A2E,color:#fff,stroke:#4A90D9,rx:6
    classDef storage fill:#FF8C00,color:#fff,stroke:#CC7000,rx:6
    classDef ai      fill:#7B2FBE,color:#fff,stroke:#5A1F8C,rx:6
    classDef local   fill:#1E7145,color:#fff,stroke:#155A34,rx:6
    classDef user    fill:#2C3E50,color:#fff,stroke:#1A252F,rx:6

    %% ── Nodes ────────────────────────────────────────────────────────────────
    USER(["👤 User\n(Browser)"]):::user

    subgraph AzureAppService["☁️  Azure App Service"]
        FE["⚛️  Frontend\nReact · Vite\n(Static SPA)"]:::app
        BE["🐍  Backend API\nFastAPI · Uvicorn"]:::app
    end

    subgraph AzureStorage["☁️  Azure Storage"]
        BLOB[("🗂️  Blob Storage\ndataset files")]:::storage
        QUEUE[("📨  Storage Queue\nbenchmark-jobs")]:::storage
    end

    subgraph AzureFunction["⚡  Azure Function App\n(Queue-triggered Worker)"]
        FN["🔧  benchmark_runner\nPython · ONNX"]:::app
        FASTEMBED["📦  fastembed / ONNX\nMiniLM · BGE\n(local inference)"]:::local
        JUDGE["⚖️  GPT-4o-mini\nLLM Judge\n(relevance scoring)"]:::ai
        ADA["🔵  Azure OpenAI\nada-002 · text-embedding-3-large\n(cloud embeddings)"]:::ai
    end

    COSMOS[("🌐  Cosmos DB\nexperiments · results")]:::azure

    %% ── Edges ────────────────────────────────────────────────────────────────
    USER -->|"HTTPS"| FE
    FE -->|"REST API calls"| BE

    BE -->|"1 · upload file"| BLOB
    BE -->|"2 · enqueue job\n(blob_name, models, config)"| QUEUE
    BE -->|"5 · read status / results"| COSMOS

    QUEUE -->|"3 · queue trigger"| FN

    FN -->|"cloud models"| ADA
    FN -->|"local models\n(no external call)"| FASTEMBED
    FN -->|"LLM judge"| JUDGE
    FN -->|"4 · write results"| COSMOS
```

---

## Component Responsibilities

| Component | Technology | Hosting |
|---|---|---|
| **Frontend** | React 19, Vite, TailwindCSS v4, shadcn/ui | Azure App Service (Linux) |
| **Backend API** | FastAPI, Python 3.12, Uvicorn | Azure App Service (Linux) |
| **File Storage** | Azure Blob Storage | Azure Storage Account |
| **Job Queue** | Azure Storage Queue (`benchmark-jobs`) | Azure Storage Account |
| **Benchmark Worker** | Azure Function App (Python, queue-triggered) | Azure Functions Consumption Plan |
| **Cloud Embeddings** | Azure OpenAI – `ada-002`, `text-embedding-3-large` | Azure OpenAI Service |
| **Local Embeddings** | fastembed / ONNX – `MiniLM-L6-v2`, `BGE-small-en-v1.5` | In-process (no external call) |
| **LLM Judge** | Azure OpenAI – `GPT-4o-mini` | Azure OpenAI Service |
| **Results Store** | Azure Cosmos DB (NoSQL) | Azure Cosmos DB |

## Data Flow

1. User uploads a CSV / JSONL dataset via the React frontend.
2. The backend stores the file in **Blob Storage** and enqueues a job message to **Storage Queue**.
3. The **Azure Function App** dequeues the job (queue trigger, invisible timeout 5 min).
4. The function runs embeddings with **both** cloud models (Azure OpenAI) and local ONNX models (fastembed).
5. A **GPT-4o-mini LLM judge** scores top-k retrieval results for semantic relevance (1–10).
6. Results are written to **Cosmos DB** (per-model metrics + judge scores).
7. The frontend polls the backend every 3 s; once `status === "completed"` the results dashboard renders.
