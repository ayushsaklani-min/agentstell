# Group B: Multi-Currency Path Payments + Agent Listings — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Feature 3 (Multi-Currency Path Payments) + Feature 2 (Agent-to-Agent Listing Type)

---

## Problem

**Feature 3:** Agents must currently hold USDC to call any marketplace API. Stellar natively supports path payments — an agent pays in XLM, the DEX converts, the provider receives exact USDC. This is a genuine technical advantage over USDC-locked competitors, but it is not wired up anywhere in the SDK, demo, or middleware.

**Feature 2:** Agents cannot distinguish data APIs from callable AI agents in the marketplace. There is no listing type for agent endpoints, no category option in the provider dashboard, and no `entityType` field in the discovery manifest.

---

## Goals

1. An agent using `agstell-sdk` can pay for API calls using XLM instead of USDC, with Stellar DEX handling conversion automatically.
2. The web demo showcases XLM path payments live with a currency toggle.
3. The x402 verification middleware accepts `path_payment_strict_receive` operations in addition to direct `payment` operations.
4. Providers can register AI agent endpoints with category `"Agent"` via the provider dashboard.
5. The discovery manifest includes `entityType: "agent" | "api"` so autonomous agents can distinguish callable agents from data APIs.

---

## Feature 3: Multi-Currency Path Payments

### Mechanism

Uses Stellar `pathPaymentStrictReceive`:
- Agent specifies: exact USDC the provider must receive (`destAmount`)
- Stellar DEX finds conversion path: XLM → USDC automatically
- Provider always receives the exact listed USDC price
- Agent pays in XLM (amount determined by current DEX rate + slippage buffer)

`pathPaymentStrictReceive` is preferred over `pathPaymentStrictSend` because the provider receives a guaranteed exact amount — no verification ambiguity.

### SDK: `agentmarket-sdk/src/stellar/client.ts`

New method `sendPathPayment(destination, destAmountUsdc, memo?)`:

1. Call `server.strictReceivePaths({ sourceAsset: StellarSdk.Asset.native(), destAsset: usdcAsset, destAmount })` to find conversion paths and current rate
2. Extract the cheapest path's `source_amount` (XLM needed)
3. Calculate `sendMax = (xlmNeeded * 1.02).toFixed(7)` — 2% slippage buffer
4. Build transaction with `StellarSdk.Operation.pathPaymentStrictReceive({ sendAsset: native, sendMax, destination, destAsset: usdc, destAmount, path: [] })`
5. Sign and submit — return same `TransactionResult` shape as `sendPayment()`

If no path is found (DEX has no liquidity), return `{ success: false, error: 'No XLM→USDC path available on DEX' }`.

### Middleware: `agentmarket/src/lib/x402/middleware.ts`

`verifyPayment()` currently iterates `operations.records` looking for `op.type === 'payment'`. Add a second branch for `op.type === 'path_payment_strict_receive'`:

```typescript
} else if (op.type === 'path_payment_strict_receive') {
  const pathOp = op as StellarSdk.Horizon.ServerApi.PathPaymentStrictReceiveOperationRecord
  if (
    pathOp.to === recipient &&
    pathOp.asset_code === usdc.code &&
    pathOp.asset_issuer === usdc.issuer &&
    parseFloat(pathOp.amount) >= expectedAmount
  ) {
    // mark used, return valid result
  }
}
```

No other middleware changes needed — the proof header format, replay protection, and timestamp check are unchanged.

### Demo pay route: `web/src/app/api/pay/route.ts`

POST body gains optional `currency?: 'USDC' | 'XLM'` (default `'USDC'`).

When `currency === 'XLM'`:
1. Query `server.strictReceivePaths()` for XLM → USDC
2. Build `pathPaymentStrictReceive` operation instead of `payment`
3. Return same response shape (txHash, proofHeader, explorerUrl)

When `currency === 'USDC'` or omitted: existing direct payment logic unchanged.

### Demo UI: `web/src/app/demo/page.tsx`

Add a two-option currency toggle (USDC / XLM) above the Call button. Default: USDC. When XLM selected, the caption below the button changes to "Sends XLM → converted to $X USDC on Stellar DEX". The `currency` field is passed to `/api/pay` POST body.

### Files

| Action | File |
|--------|------|
| Modify | `agentmarket-sdk/src/stellar/client.ts` — add `sendPathPayment()` |
| Modify | `agentmarket/src/lib/x402/middleware.ts` — handle `path_payment_strict_receive` |
| Modify | `web/src/app/api/pay/route.ts` — add XLM path payment branch |
| Modify | `web/src/app/demo/page.tsx` — currency toggle UI |

---

## Feature 2: Agent Listings

### Discovery manifest: `agentmarket/src/app/api/agents/discover/route.ts`

`AgentEntry` interface gains `entityType: 'api' | 'agent'`.

`toAgentEntry()` sets `entityType: listing.category === 'Agent' ? 'agent' : 'api'`.

No other changes to the discovery route.

### Provider dashboard: `web/src/app/provider/page.tsx`

The "Register API" form's category `<select>` gains `<option value="Agent">Agent</option>`. Order: Data, Finance, AI, Geo, Weather, News, Utilities, Agent.

### Marketplace filter: `web/src/app/marketplace/page.tsx`

The `CATEGORIES` constant gains `'Agent'` at the end of the array so the marketplace UI can filter to show only agent listings.

### Files

| Action | File |
|--------|------|
| Modify | `agentmarket/src/app/api/agents/discover/route.ts` — add `entityType` to interface + `toAgentEntry()` |
| Modify | `web/src/app/provider/page.tsx` — add "Agent" to category dropdown |
| Modify | `web/src/app/marketplace/page.tsx` — add "Agent" to `CATEGORIES` array |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| No XLM→USDC path on DEX | SDK returns `{ success: false, error: 'No XLM→USDC path available on DEX' }` |
| Path payment op not found in tx | Middleware returns `{ valid: false, error: 'Payment not found or insufficient amount' }` (same as before) |
| Slippage exceeded (tx fails on-chain) | Stellar rejects the tx; SDK catches Horizon error, returns `{ success: false, error: <Horizon result code> }` |
| Demo pay route with XLM but no path | Returns 500 with `{ error: 'No XLM→USDC conversion path available' }` |

---

## Verification

```bash
# SDK typecheck + tests
cd agentmarket-sdk && npm run typecheck && npm run test:run

# agentmarket typecheck + lint
cd agentmarket && npx tsc --noEmit && npm run lint

# web typecheck + lint
cd web && npx tsc --noEmit && npm run lint
```

Manual smoke test (XLM path payment):
- Fund demo wallet with XLM on testnet
- Open demo page, toggle to XLM, call Weather API
- Verify tx appears on Stellar Expert as `path_payment_strict_receive`
- Verify provider received correct USDC amount

---

## Out of Scope

- Supporting currencies other than XLM (EURC, BTC via Stellar bridge) — YAGNI until demand
- SDK auto-selection of cheapest currency — agent explicitly calls `sendPathPayment()` for XLM
- Agent-to-agent orchestration / task routing — separate future project
- On-chain slippage configuration — 2% hardcoded is sufficient for testnet
