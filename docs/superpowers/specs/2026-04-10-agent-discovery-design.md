# Group A: Agent-Native Discovery — Design Spec

**Date:** 2026-04-10  
**Status:** Approved  
**Scope:** Feature 1 (Agent Discovery Endpoint) + Feature 7 (CLI Dynamic Discovery)

---

## Problem

AgentMarket has rich API data — capability specs, schemas, pricing — but no single endpoint designed for autonomous agent consumption. An agent with no prior knowledge of the marketplace cannot discover what's available without the SDK or human-readable UI. The CLI also uses a hardcoded static registry that diverges from the live marketplace.

---

## Goals

1. Any agent — SDK-free, uninstructed — can discover all marketplace APIs from one URL.
2. The discovery response is self-describing: payment protocol, network, asset, and per-API contracts are all explicit.
3. The CLI registry stays in sync with the live marketplace automatically, with graceful offline fallback.

---

## Feature 1: Agent Discovery Endpoint

### Route

```
GET /api/agents/discover
```

- Free endpoint — no 402, no authentication.
- Served by `agentmarket` app, proxied through `web`.
- Returns `Content-Type: application/json`.

### Response Shape

```json
{
  "version": "1",
  "marketplace": "https://agentmarket.xyz",
  "paymentProtocol": "x402",
  "paymentNetwork": "<STELLAR_NETWORK from env, default: testnet>",
  "paymentAsset": "USDC",
  "total": 7,
  "apis": [
    {
      "slug": "weather",
      "name": "Weather API",
      "description": "Get current weather for any city worldwide",
      "category": "Data",
      "price": {
        "amount": 0.001,
        "asset": "USDC"
      },
      "endpoint": "/api/proxy/weather",
      "method": "GET",
      "input": {
        "params": [
          { "name": "city", "type": "string", "required": true, "description": "City name" }
        ],
        "schema": null,
        "example": { "city": "Tokyo" }
      },
      "output": {
        "schema": null,
        "example": { "temp": 22, "conditions": "Sunny", "humidity": 65 }
      },
      "reliability": {
        "sideEffects": "read",
        "latency": "fast",
        "idempotent": true,
        "successRate": 99.9
      },
      "provider": {
        "name": "AgentMarket",
        "stellarAddress": "GDQP..."
      }
    }
  ]
}
```

### Design Decisions

- `paymentNetwork` is read from `process.env.STELLAR_NETWORK` (defaults to `"testnet"`). When flipped to mainnet, the manifest updates automatically.
- `input.schema` and `output.schema` are `null` when the DB listing has no JSON Schema stored — agents should fall back to `input.params` and `input.example`.
- The endpoint reuses existing DB → fallback catalog logic from `agentmarket/src/lib/marketplace/catalog.ts`. No new DB queries — it maps `MarketplaceListing[]` through a new `toAgentEntry()` helper.
- `isFeatured`, `isActive`, and UI-only fields are excluded — agents don't need them.

### Files

| Action | File |
|--------|------|
| Create | `agentmarket/src/app/api/agents/discover/route.ts` |
| Create | `web/src/app/api/agents/discover/route.ts` |

### `toAgentEntry()` helper

Lives inline in the agentmarket route (not exported to catalog.ts — single use). Maps a `MarketplaceListing` to the agent-optimized shape above.

---

## Feature 7: CLI Dynamic Discovery

### Behaviour

`getRegistry()` replaces the static `API_REGISTRY` array in `cli/src/api.ts`:

1. Read `~/.agentmarket/registry.json`
2. If file exists and `cachedAt` is within 1 hour → return `apis` array
3. If stale or missing → fetch `<marketplaceUrl>/api/agents/discover`
4. On success → write to `~/.agentmarket/registry.json` with `cachedAt: Date.now()`, return `apis`
5. On fetch failure → log warning to stderr, return hardcoded static list (no crash)

### Cache File Shape

```json
{
  "cachedAt": 1744300000000,
  "apis": [ ...ApiInfo[] ]
}
```

### Mapping

The discovery endpoint returns an agent-native shape. The CLI uses `ApiInfo` (from `cli/src/types.ts`). A `toApiInfo()` mapper converts between them inside `getRegistry()` — no changes to `ApiInfo` type needed.

### Files

| Action | File |
|--------|------|
| Modify | `cli/src/api.ts` — replace static array with `getRegistry()` |
| Modify | `cli/src/config.ts` — add `readRegistryCache()` / `writeRegistryCache()` |

### Out of scope

- No changes to `listApis()` or `getApiInfo()` signatures — callers are unaffected.
- No CLI command to manually refresh the cache (YAGNI — TTL is sufficient).
- No changes to the x402 payment flow in `callApi()`.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| DB down in agentmarket | Falls back to `getFallbackCatalog()`, returns 200 with fallback data |
| agentmarket unreachable from web proxy | Web proxy returns 502 with `{ error: "Discovery service unavailable" }` |
| Marketplace fetch fails in CLI | Warns to stderr, returns hardcoded static registry |
| Cache file corrupt/unreadable | Treated as missing — fetches fresh |

---

## Verification

After implementation, run:

```bash
# Backend
cd agentmarket && npx tsc --noEmit && npm run lint

# Web
cd web && npx tsc --noEmit && npm run lint

# Manual smoke test
curl http://localhost:3001/api/agents/discover | jq '.total'
curl http://localhost:3000/api/agents/discover | jq '.total'
```

---

## Next Groups

After Group A ships:

- **Group B:** Multi-Currency Path Payments + Agent-to-Agent Payments
- **Group C:** Provider Earnings Proof + Wanted Board + API Health Monitoring
