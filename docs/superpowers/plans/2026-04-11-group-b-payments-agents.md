# Group B: Multi-Currency Path Payments + Agent Listings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XLM→USDC path payment support to the SDK, middleware, and demo; add `entityType` to the discovery manifest; and add "Agent" as a first-class listing category in the provider dashboard and marketplace.

**Architecture:** Feature 3 adds `sendPathPayment()` to `StellarClient` using `pathPaymentStrictReceive`, updates the x402 verification middleware to accept this op type, and wires XLM as an optional currency in the web demo. Feature 2 adds `entityType: 'api' | 'agent'` to the discovery manifest and "Agent" to the category dropdown — no DB migration needed since category is a free string.

**Tech Stack:** `@stellar/stellar-sdk` (path payments, Horizon server), Next.js App Router, Vitest (SDK tests only — agentmarket/web verified with tsc + lint).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `agentmarket-sdk/src/stellar/client.ts` | Add `sendPathPayment()` method |
| Create | `agentmarket-sdk/src/stellar/client.test.ts` | Tests for `sendPathPayment()` |
| Modify | `agentmarket/src/lib/x402/middleware.ts` | Accept `path_payment_strict_receive` ops in `verifyPayment()` |
| Modify | `web/src/app/api/pay/route.ts` | Add `currency: 'XLM'` branch using `pathPaymentStrictReceive` |
| Modify | `web/src/app/demo/page.tsx` | Currency toggle UI (USDC / XLM) |
| Modify | `agentmarket/src/app/api/agents/discover/route.ts` | Add `entityType` to `AgentEntry` + `toAgentEntry()` |
| Modify | `web/src/app/provider/page.tsx` | Add "Agent" to category `<Select>` |
| Modify | `web/src/app/marketplace/page.tsx` | Add "Agent" to `CATEGORIES` array |

---

## Task 1: Add `sendPathPayment()` to SDK StellarClient — tests first

**Files:**
- Modify: `agentmarket-sdk/src/stellar/client.ts`
- Create: `agentmarket-sdk/src/stellar/client.test.ts`

- [ ] **Step 1: Create the test file with three failing tests**

Create `agentmarket-sdk/src/stellar/client.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { StellarClient } from './client'

describe('StellarClient.sendPathPayment', () => {
  it('returns error when no keypair configured', async () => {
    const client = new StellarClient('testnet') // no secret key
    const result = await client.sendPathPayment('GDEST', '0.001')
    expect(result.success).toBe(false)
    expect(result.error).toContain('No secret key configured')
  })

  it('returns error when DEX has no XLM→USDC path', async () => {
    const kp = StellarSdk.Keypair.random()
    const client = new StellarClient('testnet', kp.secret())
    ;(client as any).server = {
      strictReceivePaths: vi.fn().mockReturnValue({
        call: vi.fn().mockResolvedValue({ records: [] }),
      }),
    }
    const result = await client.sendPathPayment('GDEST', '0.001')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No XLM→USDC path available on DEX')
  })

  it('submits pathPaymentStrictReceive with 2% slippage buffer', async () => {
    const kp = StellarSdk.Keypair.random()
    const client = new StellarClient('testnet', kp.secret())
    const mockAccount = new StellarSdk.Account(kp.publicKey(), '100')
    const submitMock = vi.fn().mockResolvedValue({ hash: 'abc123', ledger: 42 })
    ;(client as any).server = {
      strictReceivePaths: vi.fn().mockReturnValue({
        call: vi.fn().mockResolvedValue({
          records: [{ source_amount: '1.0000000' }],
        }),
      }),
      loadAccount: vi.fn().mockResolvedValue(mockAccount),
      submitTransaction: submitMock,
    }

    const result = await client.sendPathPayment('GDEST123', '0.001', 'test-memo')

    expect(result.success).toBe(true)
    expect(result.txHash).toBe('abc123')
    expect(result.ledger).toBe(42)
    const submittedTx = submitMock.mock.calls[0][0] as StellarSdk.Transaction
    const op = submittedTx.operations[0] as StellarSdk.Operation.PathPaymentStrictReceive
    expect(op.type).toBe('pathPaymentStrictReceive')
    expect(parseFloat(op.sendMax)).toBeCloseTo(1.02, 5)
    expect(op.destAmount).toBe('0.001')
  })
})
```

- [ ] **Step 2: Run tests — verify all 3 FAIL**

```bash
cd agentmarket-sdk && npm run test:run
```

Expected: 3 failures — `sendPathPayment is not a function`

- [ ] **Step 3: Add `sendPathPayment()` to `agentmarket-sdk/src/stellar/client.ts`**

Add this method to the `StellarClient` class, immediately after `sendPayment()`:

```typescript
/** Send payment in XLM, provider receives exact USDC via Stellar DEX path conversion */
async sendPathPayment(
  destination: string,
  destAmountUsdc: string,
  memo?: string
): Promise<TransactionResult> {
  if (!this.keypair) {
    return { success: false, error: 'No secret key configured - cannot send payments' }
  }

  try {
    // Find XLM → USDC conversion path via Stellar DEX
    const pathResult = await this.server
      .strictReceivePaths(
        [StellarSdk.Asset.native()],
        this.usdcAsset,
        destAmountUsdc
      )
      .call()

    if (!pathResult.records || pathResult.records.length === 0) {
      return { success: false, error: 'No XLM→USDC path available on DEX' }
    }

    // 2% slippage buffer on XLM sendMax
    const xlmNeeded = parseFloat(pathResult.records[0].source_amount)
    const sendMax = (xlmNeeded * 1.02).toFixed(7)

    const sourceAccount = await this.server.loadAccount(this.keypair.publicKey())

    const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: StellarSdk.Asset.native(),
          sendMax,
          destination,
          destAsset: this.usdcAsset,
          destAmount: destAmountUsdc,
          path: [],
        })
      )
      .setTimeout(30)

    if (memo) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    }

    const transaction = transactionBuilder.build()
    transaction.sign(this.keypair)
    const result = await this.server.submitTransaction(transaction)

    return {
      success: true,
      txHash: result.hash,
      ledger: result.ledger,
    }
  } catch (error) {
    return {
      success: false,
      error: extractHorizonError(error),
    }
  }
}
```

- [ ] **Step 4: Run tests — verify all 3 PASS**

```bash
cd agentmarket-sdk && npm run test:run
```

Expected: all 3 new tests pass + all pre-existing tests still pass.

- [ ] **Step 5: Type-check**

```bash
cd agentmarket-sdk && npm run typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add agentmarket-sdk/src/stellar/client.ts agentmarket-sdk/src/stellar/client.test.ts
git commit -m "feat(sdk): add sendPathPayment() using Stellar pathPaymentStrictReceive"
```

---

## Task 2: Update x402 middleware to verify path payment operations

**Files:**
- Modify: `agentmarket/src/lib/x402/middleware.ts`

The `verifyPayment()` function iterates `operations.records`. It currently only handles `op.type === 'payment'`. Add a second branch for `path_payment_strict_receive`.

- [ ] **Step 1: Read the current `verifyPayment` loop**

Read `agentmarket/src/lib/x402/middleware.ts` lines 134–169. The loop looks like:

```typescript
for (const op of operations.records) {
  if (op.type === 'payment') {
    const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord
    if (
      paymentOp.to === recipient &&
      paymentOp.asset_code === usdc.code &&
      paymentOp.asset_issuer === usdc.issuer &&
      parseFloat(paymentOp.amount) >= expectedAmount
    ) {
      // mark used, return valid
    }
  }
}
```

- [ ] **Step 2: Add `path_payment_strict_receive` branch**

After the closing `}` of the `if (op.type === 'payment')` block, add:

```typescript
} else if (op.type === 'path_payment_strict_receive') {
  const pathOp = op as StellarSdk.Horizon.ServerApi.PathPaymentStrictReceiveOperationRecord
  if (
    pathOp.to === recipient &&
    pathOp.asset_code === usdc.code &&
    pathOp.asset_issuer === usdc.issuer &&
    parseFloat(pathOp.amount) >= expectedAmount
  ) {
    usedTransactions.add(proof.txHash)

    if (usedTransactions.size > 10000) {
      const iterator = usedTransactions.values()
      for (let i = 0; i < 5000; i++) {
        usedTransactions.delete(iterator.next().value!)
      }
    }

    return {
      valid: true,
      txHash: proof.txHash,
      callerAddress: pathOp.from,
      network,
      amount: parseFloat(pathOp.amount),
    }
  }
}
```

Note: `pathOp.amount` is the **destination** USDC amount received. `pathOp.from` is the XLM sender. Both are correct for verification purposes.

- [ ] **Step 3: Type-check and lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add agentmarket/src/lib/x402/middleware.ts
git commit -m "feat(agentmarket): verify path_payment_strict_receive ops in x402 middleware"
```

---

## Task 3: Add XLM path payment branch to web demo pay route

**Files:**
- Modify: `web/src/app/api/pay/route.ts`

- [ ] **Step 1: Add `currency` to `PaymentRequest` interface**

Find the `PaymentRequest` interface (around line 26). Change it from:

```typescript
interface PaymentRequest {
  recipient: string;
  amount: string;
  memo?: string;
  network?: NetworkType;
}
```

To:

```typescript
interface PaymentRequest {
  recipient: string;
  amount: string;
  memo?: string;
  network?: NetworkType;
  currency?: 'USDC' | 'XLM';
}
```

- [ ] **Step 2: Destructure `currency` from request body in `POST`**

Find the line that destructures `body` (around line 67):

```typescript
const { recipient, amount, memo, network } = body;
```

Change to:

```typescript
const { recipient, amount, memo, network, currency } = body;
```

- [ ] **Step 3: Add the XLM path payment branch**

After the existing `const activeNetwork = configuredNetwork;` line and before the `server` / `keypair` setup, add the XLM branch. Replace the entire transaction-building block (from `const server =` through `const result = await server.submitTransaction(transaction);`) with:

```typescript
const server = new StellarSdk.Horizon.Server(NETWORKS[activeNetwork].horizonUrl);
const keypair = StellarSdk.Keypair.fromSecret(secretKey);

if (currency === 'XLM') {
  // XLM → USDC path payment via Stellar DEX
  const pathResult = await server
    .strictReceivePaths(
      [StellarSdk.Asset.native()],
      getUsdcAsset(activeNetwork),
      amount
    )
    .call();

  if (!pathResult.records || pathResult.records.length === 0) {
    return NextResponse.json(
      { error: 'No XLM→USDC conversion path available on Stellar DEX' },
      { status: 500 }
    );
  }

  const xlmNeeded = parseFloat(pathResult.records[0].source_amount);
  const sendMax = (xlmNeeded * 1.02).toFixed(7);
  const account = await server.loadAccount(keypair.publicKey());

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORKS[activeNetwork].networkPassphrase,
  }).addOperation(
    StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset: StellarSdk.Asset.native(),
      sendMax,
      destination: recipient,
      destAsset: getUsdcAsset(activeNetwork),
      destAmount: amount,
      path: [],
    })
  );

  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
  }

  const transaction = txBuilder.setTimeout(30).build();
  transaction.sign(keypair);
  const result = await server.submitTransaction(transaction);

  const proof = {
    txHash: result.hash,
    network: activeNetwork,
    timestamp: Date.now(),
  };

  return NextResponse.json({
    success: true,
    txHash: result.hash,
    ledger: result.ledger,
    amount,
    recipient,
    network: activeNetwork,
    currency: 'XLM',
    xlmSendMax: sendMax,
    proof,
    proofHeader: JSON.stringify(proof),
    explorerUrl: getExplorerUrl(activeNetwork, result.hash),
  });
}

// Default: USDC direct payment (existing code below, unchanged)
const account = await server.loadAccount(keypair.publicKey());

const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: NETWORKS[activeNetwork].networkPassphrase,
}).addOperation(
  StellarSdk.Operation.payment({
    destination: recipient,
    asset: getUsdcAsset(activeNetwork),
    amount,
  })
);

if (memo) {
  transactionBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
}

const transaction = transactionBuilder
  .setTimeout(30)
  .build();

transaction.sign(keypair);
const result = await server.submitTransaction(transaction);
```

Keep the `const proof = { ... }` and `return NextResponse.json(...)` block after the USDC branch exactly as it was.

- [ ] **Step 4: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/pay/route.ts
git commit -m "feat(web): add XLM path payment branch to demo pay route"
```

---

## Task 4: Add currency toggle to demo UI

**Files:**
- Modify: `web/src/app/demo/page.tsx`

- [ ] **Step 1: Add `currency` state**

Find the existing state declarations near the top of `DemoPage()`:

```typescript
const [selected, setSelected] = useState('weather')
const [transactions, setTransactions] = useState<Transaction[]>([])
const [loading, setLoading] = useState(false)
const [totalSpent, setTotalSpent] = useState(0)
```

Add one new state line after `totalSpent`:

```typescript
const [currency, setCurrency] = useState<'USDC' | 'XLM'>('USDC')
```

- [ ] **Step 2: Pass `currency` to the pay request in `handleCall`**

Find the `step2` fetch in `handleCall` (around line 106):

```typescript
const step2 = await fetch('/api/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ recipient: payment.recipient, amount: payment.amount, memo: payment.memo, network: payment.network }),
})
```

Add `currency` to the JSON body:

```typescript
const step2 = await fetch('/api/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ recipient: payment.recipient, amount: payment.amount, memo: payment.memo, network: payment.network, currency }),
})
```

- [ ] **Step 3: Add currency toggle UI above the Call button**

Find the `<button onClick={handleCall} ...>` element inside the API Selector panel. Add the toggle immediately before that button:

```tsx
{/* Currency toggle */}
<div className="mb-3 flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
  {(['USDC', 'XLM'] as const).map((c) => (
    <button
      key={c}
      onClick={() => setCurrency(c)}
      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
        currency === c
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {c === 'USDC' ? '💵 USDC' : '⭐ XLM → USDC'}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Update the caption below the Call button**

Find the `<p>` tag below the Call button that reads:

```tsx
<p className="mt-3 text-center text-xs text-gray-400">
  Sends <span className="font-bold text-emerald-600">${selectedApi.price.toFixed(3)} USDC</span> on Stellar testnet
</p>
```

Replace with:

```tsx
<p className="mt-3 text-center text-xs text-gray-400">
  {currency === 'USDC'
    ? <>Sends <span className="font-bold text-emerald-600">${selectedApi.price.toFixed(3)} USDC</span> on Stellar testnet</>
    : <>Pays in <span className="font-bold text-amber-600">XLM</span> → converted to <span className="font-bold text-emerald-600">${selectedApi.price.toFixed(3)} USDC</span> via Stellar DEX</>
  }
</p>
```

- [ ] **Step 5: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/demo/page.tsx
git commit -m "feat(web): add XLM/USDC currency toggle to demo page"
```

---

## Task 5: Add `entityType` to discovery manifest

**Files:**
- Modify: `agentmarket/src/app/api/agents/discover/route.ts`

- [ ] **Step 1: Add `entityType` to `AgentEntry` interface**

Find the `AgentEntry` interface. Add `entityType: 'api' | 'agent'` as the second field:

```typescript
interface AgentEntry {
  slug: string
  entityType: 'api' | 'agent'
  name: string
  description: string
  category: string
  price: { amount: number; asset: string }
  endpoint: string
  method: 'GET' | 'POST'
  input: {
    params: MarketplaceParam[]
    schema: Record<string, unknown> | null
    example: Record<string, unknown>
  }
  output: {
    schema: Record<string, unknown> | null
    example: Record<string, unknown>
  }
  reliability: {
    sideEffects: string
    latency: string
    idempotent: boolean
    successRate: number
  }
  provider: {
    name: string
    stellarAddress: string
  }
}
```

- [ ] **Step 2: Set `entityType` in `toAgentEntry()`**

In `toAgentEntry()`, add `entityType` as the second field in the returned object:

```typescript
function toAgentEntry(listing: MarketplaceListing): AgentEntry {
  const spec = listing.capabilitySpec
  return {
    slug: listing.slug,
    entityType: listing.category === 'Agent' ? 'agent' : 'api',
    name: listing.name,
    // ... rest unchanged
  }
}
```

- [ ] **Step 3: Type-check and lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add agentmarket/src/app/api/agents/discover/route.ts
git commit -m "feat(agentmarket): add entityType field to agent discovery manifest"
```

---

## Task 6: Add "Agent" category to provider dashboard and marketplace

**Files:**
- Modify: `web/src/app/provider/page.tsx`
- Modify: `web/src/app/marketplace/page.tsx`

- [ ] **Step 1: Add "Agent" to provider dashboard category select**

In `web/src/app/provider/page.tsx`, find this line (around line 485):

```tsx
{['Data', 'AI', 'Finance', 'Geo', 'Utilities', 'News', 'Weather'].map((c) => <option key={c}>{c}</option>)}
```

Change to:

```tsx
{['Data', 'AI', 'Finance', 'Geo', 'Utilities', 'News', 'Weather', 'Agent'].map((c) => <option key={c}>{c}</option>)}
```

- [ ] **Step 2: Add "Agent" to marketplace CATEGORIES filter**

In `web/src/app/marketplace/page.tsx`, find this line (around line 27):

```typescript
const CATEGORIES = ['All', 'Data', 'Finance', 'AI', 'Geo', 'Utilities', 'News', 'Weather']
```

Change to:

```typescript
const CATEGORIES = ['All', 'Data', 'Finance', 'AI', 'Geo', 'Utilities', 'News', 'Weather', 'Agent']
```

- [ ] **Step 3: Type-check and lint both**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/provider/page.tsx web/src/app/marketplace/page.tsx
git commit -m "feat(web): add Agent category to provider dashboard and marketplace filter"
```

---

## Task 7: Final verification

- [ ] **Step 1: SDK — all tests pass**

```bash
cd agentmarket-sdk && npm run test:run
```

Expected: all tests pass (includes 3 new `sendPathPayment` tests).

- [ ] **Step 2: SDK typecheck**

```bash
cd agentmarket-sdk && npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: agentmarket typecheck + lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: web typecheck + lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Confirm git log**

```bash
cd C:\Users\sakla\OneDrive\Desktop\STELLER && git log --oneline -8
```

Expected: 7 new Group B commits visible.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `sendPathPayment()` in SDK using `pathPaymentStrictReceive` | Task 1 |
| 2% slippage buffer on `sendMax` | Task 1 |
| Error when no DEX path available | Task 1 |
| Middleware accepts `path_payment_strict_receive` ops | Task 2 |
| `pathOp.amount` used for USDC verification (destination amount) | Task 2 |
| `web/api/pay` accepts `currency: 'XLM'` | Task 3 |
| XLM branch uses `strictReceivePaths` + `pathPaymentStrictReceive` | Task 3 |
| 502 when no DEX path available in demo | Task 3 |
| Demo UI currency toggle (USDC / XLM) | Task 4 |
| Caption updates to show XLM→USDC conversion | Task 4 |
| `entityType: 'api' | 'agent'` in `AgentEntry` interface | Task 5 |
| `toAgentEntry()` sets `entityType` based on `category === 'Agent'` | Task 5 |
| "Agent" in provider dashboard category `<Select>` | Task 6 |
| "Agent" in marketplace `CATEGORIES` filter | Task 6 |
