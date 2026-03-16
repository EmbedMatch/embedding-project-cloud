# Application Insights — Dashboard & Alerts

Monitoring configuration for the `embed-benchmark-fn-swe` Azure Function App.

Application Insights is **auto-created** alongside the Function App — no manual provisioning needed.
Navigate to it from: `embed-benchmark-fn-swe` → **Application Insights** (left sidebar).

---

## Dashboard — KQL Queries

Open the **Logs** blade inside Application Insights and save each query below as a tile on the **Dashboard**.

### 1. Function Invocation Rate (last 24h)

```kusto
requests
| where timestamp > ago(24h)
| where cloud_RoleName == "embed-benchmark-fn-swe"
| summarize invocations = count() by bin(timestamp, 1h)
| render timechart
```

### 2. Failed Invocations (last 24h)

```kusto
requests
| where timestamp > ago(24h)
| where success == false
| where cloud_RoleName == "embed-benchmark-fn-swe"
| summarize failures = count() by bin(timestamp, 1h)
| render timechart
```

### 3. Average Execution Duration (ms)

```kusto
requests
| where timestamp > ago(24h)
| where cloud_RoleName == "embed-benchmark-fn-swe"
| summarize avg_duration_ms = avg(duration) by bin(timestamp, 1h)
| render timechart
```

### 4. Exception Breakdown

```kusto
exceptions
| where timestamp > ago(24h)
| where cloud_RoleName == "embed-benchmark-fn-swe"
| summarize count() by type, outerMessage
| order by count_ desc
| take 20
```

### 5. Queue Message Processing Latency

Tracks how long each benchmark job takes from queue trigger to completion.

```kusto
customMetrics
| where timestamp > ago(24h)
| where name == "benchmark_duration_ms"
| summarize avg(value), max(value), min(value) by bin(timestamp, 30m)
| render timechart
```

### 6. Live Errors (last 1h)

```kusto
traces
| where severityLevel >= 3
| where timestamp > ago(1h)
| where cloud_RoleName == "embed-benchmark-fn-swe"
| project timestamp, message, severityLevel, operation_Id
| order by timestamp desc
```

---

## Failure Alerts

Set up the following alert rules in:
`embed-benchmark-fn-swe` → Application Insights → **Alerts** → **+ Create alert rule**

### Alert 1 — Function Failure Spike

| Field | Value |
|-------|-------|
| **Signal** | Custom log search |
| **Query** | _see below_ |
| **Aggregation** | Count |
| **Operator** | Greater than |
| **Threshold** | `3` |
| **Evaluation period** | 5 minutes |
| **Frequency** | Every 5 minutes |
| **Severity** | Sev 2 (Warning) |
| **Action group** | _create one with email notification_ |

```kusto
requests
| where success == false
| where cloud_RoleName == "embed-benchmark-fn-swe"
```

### Alert 2 — Function Not Firing (Dead Queue)

Fires if the function has had **zero invocations** for 30 minutes (possible dead queue or quota exceeded).

| Field | Value |
|-------|-------|
| **Signal** | Custom log search |
| **Query** | _see below_ |
| **Aggregation** | Count |
| **Operator** | Less than |
| **Threshold** | `1` |
| **Evaluation period** | 30 minutes |
| **Frequency** | Every 30 minutes |
| **Severity** | Sev 1 (Critical) |

```kusto
requests
| where cloud_RoleName == "embed-benchmark-fn-swe"
```

### Alert 3 — Avg Execution Duration > 120s

If the benchmark function takes too long, it may be stuck or hitting timeouts.

| Field | Value |
|-------|-------|
| **Signal** | `Function Execution Duration` (built-in metric) |
| **Aggregation** | Average |
| **Operator** | Greater than |
| **Threshold** | `120000` ms |
| **Evaluation period** | 15 minutes |
| **Severity** | Sev 2 (Warning) |

---

## Setting Up an Action Group (Email Alerts)

1. Go to **Monitor** → **Alerts** → **Action groups** → **+ Create**
2. **Resource group**: `EmbedMatch`
3. **Action group name**: `embed-oncall`
4. **Display name**: `EmbedOncall`
5. Under **Notifications** → **+ Add notification**:
   - **Type**: Email/SMS/Push/Voice
   - **Email**: add the team email addresses
6. Click **Review + create** → **Create**

Then attach this action group to each alert rule created above.

---

## Portal Navigation Quick Reference

| Goal | Path |
|------|------|
| View live logs | `embed-benchmark-fn-swe` → Application Insights → **Logs** |
| Live stream | `embed-benchmark-fn-swe` → Application Insights → **Live Metrics** |
| Failure investigation | Application Insights → **Failures** blade |
| Performance | Application Insights → **Performance** blade |
| All alerts | **Monitor** (top search bar) → **Alerts** |
