# C1: Provider Earnings Proof — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Public earnings-proof endpoint + provider dashboard panel

---

## Problem

Providers have no way to prove their earnings to external parties. The data exists (every paid call is recorded in `ApiCall` with a `txHash`), but there is no endpoint that assembles it into a verifiable document and no UI surface that lets a provider share or download it.

---

## Goals

1. `GET /api/provider/earnings-proof?address=G...&days=30` returns a verifiable JSON proof document listing every on-chain transaction that contributed to the provider's earnings in the given period.
2. Any third party can verify the proof by looking up each `txHash` on Stellar Expert.
3. The provider dashboard has an "Earnings Proof" section with a summary display and a "Download JSON" button.

---

## Proof Document Shape

```json
{
  "provider": "GDEMO...",
  "generatedAt": "2026-04-11T12:00:00.000Z",
  "periodDays": 30,
  "totalEarningsUsdc": 12.450,
  "callCount": 83,
  "successfulCalls": 79,
  "breakdown": [
    { "slug": "weather", "calls": 45, "earningsUsdc": 0.045 },
    { "slug": "ai",      "calls": 38, "earningsUsdc": 12.405 }
  ],
  "transactions": [
    {
      "txHash": "abc123...",
      "apiSlug": "weather",
      "amountUsdc": 0.001,
      "timestamp": "2026-04-10T08:22:01.000Z",
      "success": true
    }
  ],
  "stellarExplorerBase": "https://testnet.stellarchain.io/tx/"
}
```

- `breakdown` is sorted by `earningsUsdc` descending.
- `transactions` is sorted by `timestamp` descending (most recent first).
- `stellarExplorerBase` lets verifiers construct `stellarExplorerBase + txHash` URLs without knowing the network.
- Failed calls (`success: false`) are included in `transactions` but excluded from `totalEarningsUsdc` and `breakdown` earnings.

---

## API Endpoint

### `GET /api/provider/earnings-proof`

**Query params:**
- `address` (required) — provider's Stellar address
- `days` (optional, default `30`, max `365`) — number of days to look back

**Logic:**
1. Find `Provider` by `stellarAddress`. If not found → 404 `{ error: 'Provider not found' }`.
2. Query `ApiCall` records via `ApiListing.providerId` where `createdAt >= now - days`. Include `apiListing { slug }`.
3. Build and return the proof document JSON.
4. If DB unavailable → 503 `{ error: 'Service unavailable' }`.
5. If no calls in period → 200 with `callCount: 0`, empty `breakdown` and `transactions` arrays.

**No authentication required** — the proof is public by design. The Stellar address is the identifier.

---

## Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `agentmarket/src/app/api/provider/earnings-proof/route.ts` | Query Prisma, build proof document, return JSON |
| Create | `web/src/app/api/provider/earnings-proof/route.ts` | Thin proxy to agentmarket backend |
| Modify | `web/src/app/provider/page.tsx` | Add "Earnings Proof" section with summary + Download JSON button |

---

## Provider Dashboard Integration

The provider dashboard (`web/src/app/provider/page.tsx`) gets a new "Earnings Proof" section below the existing Calls section. It shows:

- Period selector (7 / 30 / 90 days) — defaults to 30
- Summary row: total earnings, call count, successful calls
- Per-API breakdown table (slug, calls, earnings)
- "Download Proof JSON" button — fetches `/api/provider/earnings-proof?address=<providerAddress>&days=<selected>` and triggers a browser download of the JSON file named `earnings-proof-<address-prefix>-<date>.json`
- "Share Link" button — copies the proof URL to clipboard

The section only renders when the dashboard has loaded and `provider.stellarAddress` is available. If the proof fetch fails, show an inline error with a retry button.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `address` param missing | 400 `{ error: 'address query param required' }` |
| Provider not found | 404 `{ error: 'Provider not found' }` |
| `days` param invalid (non-numeric, < 1, > 365) | 400 `{ error: 'days must be between 1 and 365' }` |
| No calls in period | 200, `callCount: 0`, empty arrays |
| DB unavailable | 503 `{ error: 'Service unavailable' }` |

---

## Verification

```bash
# agentmarket typecheck + lint
cd agentmarket && npx tsc --noEmit && npm run lint

# web typecheck + lint
cd web && npx tsc --noEmit && npm run lint
```

Manual smoke test:
- Register a provider, make a paid call, hit `/api/provider/earnings-proof?address=G...`
- Verify txHash appears and can be looked up on Stellar Expert testnet

---

## Out of Scope

- Cryptographic signatures on the proof document — on-chain txHashes are the proof
- Pagination of the `transactions` array — 365 days × typical volume is manageable in one response
- Email delivery of proof — YAGNI
