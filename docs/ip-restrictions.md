# IP Restrictions & Firewall Setup

Security hardening for both App Services and Cosmos DB.
Run **after** the App Services are deployed (PR #19 merged and deploy workflows triggered).

---

## Overview

| Resource | Change |
|----------|--------|
| `embed-match-web` (backend App Service) | IP allowlist — only team members |
| `embed-match-frontend` (frontend App Service) | IP allowlist — only team members |
| `embed-db` (Cosmos DB) | Whitelist all **possible** outbound IPs of the backend App Service |

> ⚠️ **Important**: Use `possibleOutboundIpAddresses` (up to ~20 IPs), NOT just  
> `outboundIpAddresses` (4-5 IPs). Under load Azure may use any of the "possible" ones,
> and Cosmos DB will reject requests from any unwhitelisted IP.

---

## Step 1 — Add Team IPs to Both App Services

### Via Azure Portal

1. Open `embed-match-web` (or `embed-match-frontend`) → **Networking** → **Access restriction**
2. Click **+ Add** under "Main site"
3. For **each team member**, add a rule:
   | Field | Value |
   |-------|-------|
   | Name | `member-name` |
   | Action | Allow |
   | Priority | 100, 101, 102 ... (increment per rule) |
   | Type | IPv4 |
   | IP block | `<member-ip>/32` |
4. Make sure **Unmatched rule action** is set to **Deny**
5. Repeat for both `embed-match-web` **and** `embed-match-frontend`

### Via Azure CLI (faster)

```bash
# Set variables
RESOURCE_GROUP="EmbedMatch"
BACKEND_APP="embed-match-web"
FRONTEND_APP="embed-match-frontend"

# Add team IPs — replace with real IPs
TEAM_IPS=("MEMBER_1_IP" "MEMBER_2_IP" "MEMBER_3_IP" "MEMBER_4_IP")
NAMES=("member-1" "member-2" "member-3" "member-4")

for i in "${!TEAM_IPS[@]}"; do
  # Backend App Service
  az webapp config access-restriction add \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP" \
    --rule-name "${NAMES[$i]}" \
    --action Allow \
    --ip-address "${TEAM_IPS[$i]}/32" \
    --priority $((100 + i))

  # Frontend App Service
  az webapp config access-restriction add \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FRONTEND_APP" \
    --rule-name "${NAMES[$i]}" \
    --action Allow \
    --ip-address "${TEAM_IPS[$i]}/32" \
    --priority $((100 + i))
done
```

---

## Step 2 — Whitelist Backend Outbound IPs on Cosmos DB

The backend App Service has a pool of possible outbound IPs that Azure may use. 
You must whitelist **all** of them on Cosmos DB, not just the ones shown at a point in time.

### Get all possible outbound IPs

```bash
RESOURCE_GROUP="EmbedMatch"
BACKEND_APP="embed-match-web"

az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_APP" \
  --query possibleOutboundIpAddresses \
  --output tsv
```

This returns a comma-separated list like:
```
20.x.x.x,20.x.x.x,20.x.x.x,...
```

### Add them to Cosmos DB firewall

```bash
COSMOS_ACCOUNT="embed-db"

# Get the IPs as an array
OUTBOUND_IPS=$(az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_APP" \
  --query possibleOutboundIpAddresses \
  --output tsv)

# Convert comma-separated to space-separated for the Az CLI
IP_LIST=$(echo "$OUTBOUND_IPS" | tr ',' ' ')

# Add each IP to Cosmos DB firewall
for IP in $IP_LIST; do
  az cosmosdb update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$COSMOS_ACCOUNT" \
    --ip-range-filter "$IP"
done
```

> ⚠️ Note: Each `az cosmosdb update --ip-range-filter` **replaces** the entire filter list,
> not appends. Use the bulk approach below instead:

### Bulk update (recommended)

```bash
RESOURCE_GROUP="EmbedMatch"
BACKEND_APP="embed-match-web"
COSMOS_ACCOUNT="embed-db"

# Get all possible outbound IPs
OUTBOUND_IPS=$(az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$BACKEND_APP" \
  --query possibleOutboundIpAddresses \
  --output tsv)

# Add team IPs alongside the App Service IPs
TEAM_IPS="MEMBER_1_IP,MEMBER_2_IP,MEMBER_3_IP,MEMBER_4_IP"

# Combine all IPs into one comma-separated string
ALL_IPS="${OUTBOUND_IPS},${TEAM_IPS}"

# Apply to Cosmos DB in one shot
az cosmosdb update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COSMOS_ACCOUNT" \
  --ip-range-filter "$ALL_IPS"

echo "✅ Cosmos DB firewall updated with $(echo $ALL_IPS | tr ',' '\n' | wc -l) IPs"
```

### Via Portal (manual alternative)

1. Go to `embed-db` → **Networking** (under Settings)
2. Select **Selected networks**
3. Under **Firewall**, click **Add your client IP** for your own IP
4. Then paste each IP from `possibleOutboundIpAddresses` one by one
5. Click **Save**

---

## Step 3 — Verify

After applying:

```bash
# Confirm backend App Service restrictions
az webapp config access-restriction show \
  --resource-group EmbedMatch \
  --name embed-match-web \
  --query mainSiteAccessRestrictions

# Confirm Cosmos DB firewall rules
az cosmosdb show \
  --resource-group EmbedMatch \
  --name embed-db \
  --query ipRules
```

And verify your health check still works from a whitelisted machine:

```bash
curl https://embed-match-web.azurewebsites.net/health
```

---

## ⚠️ Local Development After Lockdown

Once these rules are applied, your local `uvicorn` can **no longer reach Cosmos DB**
unless your home IP is in the firewall list.

**Keep your local IP in the Cosmos DB firewall** while developing, and remove it before final handover.
