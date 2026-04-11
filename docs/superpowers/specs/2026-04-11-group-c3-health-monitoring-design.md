# C3: API Health Monitoring — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** On-demand health check endpoint with 5-minute DB cache + marketplace badge UI

---

## Problem

The marketplace shows API listings but gives no indication of whether the underlying upstream endpoint is currently reachable. Agents have no way to avoid calling a broken API before paying for it.

---

## Goals

1. `GET /api/health/[slug]` checks the upstream URL of a listing and returns its health status.
2. Results are cached in the DB for 5 minutes — the endpoint returns cached data immediately on warm cache, avoiding N live pings on every marketplace page load.
3. The marketplace page fetches health for all visible listings on mount and shows a coloured dot badge on each card.

---

## Health Status Classification

| Result | Status | Condition |
|--------|--------|-----------|
| `healthy` | 🟢 | 2xx response in < 1000ms |
| `degraded` | 🟡 | 2xx response in ≥ 1000ms |
| `down` | 🔴 | non-2xx, timeout (3s), or network error |
| `unknown` | ⚪ | never checked (null in DB) |

---

## DB Changes

Three new optional fields added to `ApiListing` in `agentmarket/prisma/schema.prisma`:

```prisma
healthStatus    String?   // "healthy" | "degraded" | "down"
healthCheckedAt DateTime?
healthLatencyMs Int?
```

No new model. Migration: `npx prisma migrate dev --name add-listing-health`

---

## API Endpoint

### `GET /api/health/[slug]`

**Logic:**
1. Load `ApiListing` by slug (`isActive: true`). If not found → 404.
2. If `healthCheckedAt` is set and less than 5 minutes ago → return cached result immediately (no upstream ping).
3. Otherwise: send a `GET` request to `listing.endpoint` with a 3-second `AbortController` timeout. No query params, no auth headers.
4. Classify result by status code and latency.
5. Write `healthStatus`, `healthCheckedAt`, `healthLatencyMs` back to `ApiListing`.
6. Return health JSON.

**Response:**
```json
{
  "slug": "weather",
  "status": "healthy",
  "latencyMs": 342,
  "checkedAt": "2026-04-11T12:00:00.000Z",
  "cached": false
}
```

`cached: true` when the 5-minute cache was used (no live ping performed).

**Note:** The health check pings `listing.endpoint` directly — the raw upstream URL, not the agentmarket proxy. This tests actual provider uptime, not our own routing.

---

## Files

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `agentmarket/prisma/schema.prisma` | Add 3 health fields to `ApiListing` |
| Create | `agentmarket/src/app/api/health/[slug]/route.ts` | Cache check + upstream ping + DB write + response |
| Create | `web/src/app/api/health/[slug]/route.ts` | Thin proxy to agentmarket backend |
| Modify | `web/src/app/marketplace/page.tsx` | Fetch health per listing on mount, show badge on each card |

---

## Marketplace UI Integration

`web/src/app/marketplace/page.tsx`:

**State:** `healthMap: Record<string, 'healthy' | 'degraded' | 'down' | 'unknown' | 'loading'>` — keyed by slug, initialised to `'loading'` for all visible listings.

**On mount:** fire parallel `fetch('/api/health/<slug>')` for each listing in the current filtered view. Update `healthMap` as each resolves. On fetch error, set slug to `'unknown'`.

**Badge:** A small dot (6×6px) in the top-right corner of each listing card:
- `loading` → gray animated pulse
- `healthy` → solid green
- `degraded` → solid yellow
- `down` → solid red
- `unknown` → gray (no pulse)

Badge has a `title` attribute showing status + latency (e.g., `"healthy · 342ms"`) for hover tooltip.

**Re-check:** No automatic polling. The user can refresh the page to re-trigger health checks (cache ensures re-checks are fast on warm cache).

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Listing not found | 404 `{ error: 'Listing not found' }` |
| Upstream request times out (3s) | status: `down`, `latencyMs: 3000` |
| Upstream non-2xx | status: `down`, `latencyMs` recorded |
| DB write fails after check | Log error, still return the live result |
| DB unavailable on load | 503 `{ error: 'Service unavailable' }` |

---

## Verification

```bash
cd agentmarket && npx prisma migrate dev --name add-listing-health
cd agentmarket && npx tsc --noEmit && npm run lint
cd web && npx tsc --noEmit && npm run lint
```

Manual smoke test:
- Load marketplace page, verify colored dots appear on listing cards
- Hit `/api/health/<slug>` directly, verify `cached: false` then `cached: true` within 5 minutes
- Set listing endpoint to an invalid URL, verify dot turns red

---

## Out of Scope

- Background health check scheduler — no persistent background jobs in Next.js without a separate service
- Health check history / uptime percentage — YAGNI for first version
- Alerting providers when their API goes down — YAGNI
- Checking POST endpoints (health checks are GET-only, even for POST listings)
