# Azure Cloud Configuration (Portal UI)

Step-by-step guide for provisioning all Azure resources used by the EmbedBench platform, configured entirely through the Azure Portal.

---

## 1. Resource Group

1. Go to **Resource groups** > **Create**
2. **Subscription**: Azure for Students
3. **Resource group**: `EmbedMatch`
4. **Region**: Switzerland North
5. Click **Review + create** > **Create**

---

## 2. Storage Account

1. Go to **Storage accounts** > **Create**
2. **Resource group**: `EmbedMatch`
3. **Storage account name**: `embedstorage20147`
4. **Region**: Switzerland North
5. **Performance**: Standard
6. **Redundancy**: LRS (Locally-redundant storage)
7. Click **Review + create** > **Create**

### Blob Container

1. Open `embedstorage20147` > **Containers** (under Data storage)
2. Click **+ Container**
3. **Name**: `uploads`
4. **Public access level**: Private
5. Click **Create**

### Storage Queue

1. Open `embedstorage20147` > **Queues** (under Data storage)
2. Click **+ Queue**
3. **Name**: `benchmark-jobs`
4. Click **Create**

### Connection String

1. Open `embedstorage20147` > **Access keys** (under Security + networking)
2. Click **Show** next to key1 Connection string
3. Copy and save as `AZURE_STORAGE_CONNECTION_STRING` in backend `.env`

---

## 3. Cosmos DB

1. Go to **Azure Cosmos DB** > **Create** > **Azure Cosmos DB for NoSQL**
2. **Resource group**: `EmbedMatch`
3. **Account name**: `embed-db`
4. **Region**: Switzerland North
5. **Capacity mode**: Serverless
6. Click **Review + create** > **Create**

### Database and Container

1. Open `embed-db` > **Data Explorer**
2. Click **New Container**
3. **Database id**: Create new > `embedbench`
4. **Container id**: `experiments`
5. **Partition key**: `/id`
6. Click **OK**

### Connection String

1. Open `embed-db` > **Keys** (under Settings)
2. Copy **URI** and **PRIMARY KEY**
3. Save as `COSMOS_ENDPOINT` and `COSMOS_KEY` in backend `.env`

---

## 4. Azure OpenAI

1. Go to **Azure AI services** > **Create** > **Azure OpenAI**
2. **Resource group**: `EmbedMatch`
3. **Region**: Sweden Central (Switzerland North has no chat model quota)
4. **Name**: `embed-openai-sweden`
5. **Pricing tier**: Standard S0
6. Click **Review + submit** > **Create**

### Model Deployments

1. Open `embed-openai-sweden` > **Model deployments** > **Manage Deployments** (opens Azure AI Foundry)
2. Click **+ Deploy model** > **Deploy base model** for each:

| Deployment name | Model | Version | TPM |
|----------------|-------|---------|-----|
| `gpt-4o-mini` | gpt-4o-mini | latest | 30K |
| `text-embedding-ada-002` | text-embedding-ada-002 | 2 | 120K |
| `text-embedding-3-large` | text-embedding-3-large | latest | 120K |

### Endpoint and Key

1. Open `embed-openai-sweden` > **Keys and Endpoint** (under Resource Management)
2. Copy **Endpoint** (should be `https://embed-openai-sweden.openai.azure.com/`) and **KEY 1**
3. Save as `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` in backend `.env`
4. Set `AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini` in `.env`

> **Important**: The endpoint must use a custom subdomain (`embed-openai-sweden.openai.azure.com`), not the shared regional endpoint (`swedencentral.api.cognitive.microsoft.com`). This is configured automatically when creating through the Portal.

---

## 5. Backend App Service

1. Go to **App Services** > **Create** > **Web App**
2. **Resource group**: `EmbedMatch`
3. **Name**: `embed-match-web`
4. **Publish**: Code
5. **Runtime stack**: Python 3.12
6. **Region**: Switzerland North
7. **Pricing plan**: Free F1
8. Click **Review + create** > **Create**

### Configuration

1. Open `embed-match-web` > **Environment variables** (under Settings)
2. Add all backend environment variables:
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `COSMOS_ENDPOINT`
   - `COSMOS_KEY`
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_DEPLOYMENT`
   - `CORS_ORIGINS` (set to frontend URL)

### Startup Command

1. Open `embed-match-web` > **Configuration** (under Settings) > **General settings**
2. **Startup Command**: `python -m uvicorn src.main:app --host 0.0.0.0 --port 8000`

---

## 6. Frontend App Service

1. Go to **App Services** > **Create** > **Web App**
2. **Resource group**: `EmbedMatch`
3. **Name**: `embed-match-frontend`
4. **Publish**: Code
5. **Runtime stack**: Node 22 LTS
6. **Region**: Switzerland North
7. **Pricing plan**: Free F1
8. Click **Review + create** > **Create**

### Startup Command

1. Open `embed-match-frontend` > **Configuration** > **General settings**
2. **Startup Command**: `npx serve . -s -l $PORT`

> **Note**: The `-s` flag enables SPA (single-page app) mode, which serves `index.html` for all routes — required for React Router to work.

---

## 7. Function App

1. Go to **Function App** > **Create**
2. **Resource group**: `EmbedMatch`
3. **Function App name**: `embed-benchmark-fn-swe`
4. **Runtime stack**: Python 3.12
5. **Version**: 3.12
6. **Region**: Sweden Central (colocated with OpenAI resource)
7. **Hosting plan**: Consumption (Serverless)
8. **Storage account**: select `embedstorage20147`
9. Click **Review + create** > **Create**

### Configuration

1. Open `embed-benchmark-fn-swe` > **Environment variables**
2. Add:
   - `AZURE_STORAGE_CONNECTION_STRING` (same as backend)
   - `COSMOS_ENDPOINT`
   - `COSMOS_KEY`
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_CHAT_DEPLOYMENT` = `gpt-4o-mini`
   - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` = `text-embedding-ada-002`

> **Note**: The Function App is in Sweden Central (not Switzerland North) because it needs to be near the OpenAI resource for low latency, and the Linux Consumption plan is not available in Switzerland North.

---

## 8. Access Control (IP Restrictions)

Both App Services have IP-based access restrictions to limit who can reach the apps.

1. Open the App Service > **Networking** > **Access restriction**
2. Click **+ Add** under the main site rules
3. **Name**: `allowed`
4. **Action**: Allow
5. **Priority**: 100
6. **Type**: IPv4
7. **IP Address Block**: your IP address / 32
8. Set the **Unmatched rule action** to **Deny**

Repeat for both `embed-match-web` and `embed-match-frontend`.

### Cosmos DB Firewall

1. Open `embed-db` > **Networking** (under Settings)
2. Select **Selected networks**
3. Under **Firewall**, add the backend App Service's **outbound IP addresses**
   - Find these in `embed-match-web` > **Networking** > **Outbound addresses** (use all IPs listed under "Possible outbound IP addresses")
4. Click **Save**

---

## Resource Summary

| # | Resource | Type | Region | Pricing |
|---|----------|------|--------|---------|
| 1 | `EmbedMatch` | Resource Group | Switzerland North | — |
| 2 | `embedstorage20147` | Storage Account | Switzerland North | Pay-as-you-go |
| 3 | `embed-db` | Cosmos DB (NoSQL, Serverless) | Switzerland North | Pay-as-you-go |
| 4 | `embed-openai-sweden` | Azure OpenAI | Sweden Central | Pay-as-you-go |
| 5 | `embed-match-web` | App Service (Python 3.12) | Switzerland North | Free F1 |
| 6 | `embed-match-frontend` | App Service (Node 22) | Switzerland North | Free F1 |
| 7 | `embed-benchmark-fn-swe` | Function App (Consumption) | Sweden Central | Pay-as-you-go |

### Auto-created resources

These resources are created automatically by Azure when provisioning the above services — no manual setup needed:

| Resource | Type | Notes |
|----------|------|-------|
| `ASP-EmbedMatch-8d75` | App Service Plan | Shared hosting plan for both App Services (Free F1 tier) |
| `SwedenCentralLinuxDynamicPlan` | Consumption Plan | Serverless compute plan for the Function App (pay-per-execution) |
| `embed-benchmark-fn-swe` | Application Insights | Monitoring and logging for the Function App (request traces, failures, performance) |
| `Application Insights Smart Detection` | Alert Rule | Auto-generated anomaly detection alerts for Application Insights |
