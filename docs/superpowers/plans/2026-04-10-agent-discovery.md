# Group A: Agent-Native Discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free, machine-readable `/api/agents/discover` endpoint that lets any agent discover all marketplace APIs autonomously, and sync the CLI to fetch its registry from that endpoint instead of a hardcoded static list.

**Architecture:** The agentmarket backend gains a new route that maps existing marketplace data (DB → fallback catalog) into an agent-optimized JSON manifest. A thin web proxy forwards the route. The CLI gains a registry cache in `~/.agentmarket/registry.json` (1-hour TTL) and fetches from the discovery endpoint at command time, falling back to a hardcoded static list on failure.

**Tech Stack:** Next.js App Router (agentmarket + web), TypeScript, Vitest (CLI tests only — agentmarket verified with tsc/lint/build), Node.js `fs` module (CLI cache).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `agentmarket/src/app/api/agents/discover/route.ts` | Agent discovery endpoint + `toAgentEntry()` mapper |
| Create | `web/src/app/api/agents/discover/route.ts` | Thin proxy to agentmarket backend |
| Modify | `cli/src/config.ts` | Add `REGISTRY_CACHE_FILE`, `readRegistryCache()`, `writeRegistryCache()` |
| Modify | `cli/src/api.ts` | Replace static `API_REGISTRY` with `_registry` + `refreshRegistry()` |
| Modify | `cli/src/cli.ts` | Make `list` and `call` actions async; call `refreshRegistry()` before use |
| Modify | `cli/src/api.test.ts` | Extend mock + add tests for `refreshRegistry()` |

---

## Task 1: Create the agentmarket agent discovery route

**Files:**
- Create: `agentmarket/src/app/api/agents/discover/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// agentmarket/src/app/api/agents/discover/route.ts
import { NextResponse } from 'next/server'
import { getFallbackCatalog, getPrismaListings } from '@/lib/marketplace/catalog'
import type { MarketplaceListing } from '@/lib/marketplace/catalog'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface AgentParam {
  name: string
  type: string
  required: boolean
  description: string
}

interface AgentEntry {
  slug: string
  name: string
  description: string
  category: string
  price: { amount: number; asset: string }
  endpoint: string
  method: 'GET' | 'POST'
  input: {
    params: AgentParam[]
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

function toAgentEntry(listing: MarketplaceListing): AgentEntry {
  const spec = listing.capabilitySpec
  return {
    slug: listing.slug,
    name: listing.name,
    description: listing.description,
    category: listing.category,
    price: { amount: listing.priceUsdc, asset: 'USDC' },
    endpoint: listing.endpoint,
    method: listing.method,
    input: {
      params: spec.params,
      schema: spec.requestSchema,
      example: spec.exampleRequest,
    },
    output: {
      schema: spec.responseSchema,
      example: spec.exampleResponse,
    },
    reliability: {
      sideEffects: spec.sideEffectLevel,
      latency: spec.latencyHint,
      idempotent: spec.idempotent,
      successRate: listing.successRate,
    },
    provider: {
      name: listing.providerName,
      stellarAddress: listing.providerStellarAddress,
    },
  }
}

export async function GET() {
  const network = process.env.STELLAR_NETWORK ?? 'testnet'
  const marketplace = process.env.AGENTMARKET_BASE_URL ?? 'https://agentmarket.xyz'

  let listings: MarketplaceListing[] = []

  try {
    const prisma = getPrismaClient()
    const { mapDbListing } = await import('@/lib/marketplace/catalog')
    const rows = await prisma.apiListing.findMany({
      where: { isActive: true },
      include: { provider: { select: { name: true, stellarAddress: true } } },
      orderBy: [{ isFeatured: 'desc' }, { totalCalls: 'desc' }],
    })
    if (rows.length > 0) {
      listings = rows.map(mapDbListing)
    }
  } catch {
    // DB unavailable — fall through to catalog
  }

  if (listings.length === 0) {
    listings = getFallbackCatalog()
  }

  const apis = listings.map(toAgentEntry)

  return NextResponse.json({
    version: '1',
    marketplace,
    paymentProtocol: 'x402',
    paymentNetwork: network,
    paymentAsset: 'USDC',
    total: apis.length,
    apis,
  })
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd agentmarket
npx tsc --noEmit
npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add agentmarket/src/app/api/agents/discover/route.ts
git commit -m "feat(agentmarket): add /api/agents/discover endpoint"
```

---

## Task 2: Create the web proxy route

**Files:**
- Create: `web/src/app/api/agents/discover/route.ts`

- [ ] **Step 1: Create the proxy file**

Follow the exact pattern used by `web/src/app/api/provider/dashboard/route.ts`.

```typescript
// web/src/app/api/agents/discover/route.ts
import { NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET() {
  try {
    const response = await fetch(
      new URL('/api/agents/discover', getBackendBaseUrl())
    )
    const body = await response.text()

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Discovery service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd web
npx tsc --noEmit
npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Smoke test (requires both servers running)**

```bash
# In one terminal: cd agentmarket && npm run dev
# In another terminal: cd web && npm run dev
curl http://localhost:3001/api/agents/discover | jq '.total'
curl http://localhost:3000/api/agents/discover | jq '.total'
```

Expected: both return an integer (≥ 1).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/agents/discover/route.ts
git commit -m "feat(web): proxy /api/agents/discover to agentmarket backend"
```

---

## Task 3: Add CLI registry cache helpers

**Files:**
- Modify: `cli/src/config.ts`
- Modify: `cli/src/api.test.ts` (partial — add mock entries for new functions)

The CLI config already handles `CONFIG_DIR = ~/.agentmarket`. Add a cache file alongside the existing `history.json`.

- [ ] **Step 1: Add cache constants and helpers to `cli/src/config.ts`**

Add the following **after the existing `HISTORY_FILE` constant** and **before the `CONTRACTS` export**:

```typescript
const REGISTRY_CACHE_FILE = path.join(CONFIG_DIR, 'registry.json')

export interface RegistryCache {
  cachedAt: number
  apis: import('./types').ApiInfo[]
}

export function readRegistryCache(): RegistryCache | null {
  try {
    if (!fs.existsSync(REGISTRY_CACHE_FILE)) return null
    const data = fs.readFileSync(REGISTRY_CACHE_FILE, 'utf-8')
    return JSON.parse(data) as RegistryCache
  } catch {
    return null
  }
}

export function writeRegistryCache(apis: import('./types').ApiInfo[]): void {
  try {
    ensureConfigDir()
    const cache: RegistryCache = { cachedAt: Date.now(), apis }
    fs.writeFileSync(REGISTRY_CACHE_FILE, JSON.stringify(cache, null, 2))
  } catch {
    // Cache write failure is non-fatal — silently ignore
  }
}
```

- [ ] **Step 2: Run existing tests to confirm no regression**

```bash
cd cli
npm run test
```

Expected: all 3 existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add cli/src/config.ts
git commit -m "feat(cli): add registry cache helpers to config"
```

---

## Task 4: Replace CLI static registry with dynamic `refreshRegistry()`

**Files:**
- Modify: `cli/src/api.ts`
- Modify: `cli/src/api.test.ts`

- [ ] **Step 1: Update the mock in `cli/src/api.test.ts` to include new config exports**

Replace the existing `vi.hoisted` block and `vi.mock` call at the top of the file with:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadConfig, appendHistory, readRegistryCache, writeRegistryCache } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  appendHistory: vi.fn(),
  readRegistryCache: vi.fn(),
  writeRegistryCache: vi.fn(),
}));

vi.mock('./config', () => ({
  loadConfig,
  appendHistory,
  readRegistryCache,
  writeRegistryCache,
}));

import { callApi, getApiInfo, listApis, refreshRegistry } from './api';
```

- [ ] **Step 2: Add `refreshRegistry` tests to `cli/src/api.test.ts`**

Add a new `describe` block after the existing `describe('CLI API client', ...)` block:

```typescript
describe('refreshRegistry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readRegistryCache.mockReset();
    writeRegistryCache.mockReset();
    loadConfig.mockReturnValue({
      marketplaceUrl: 'https://agentmarket.xyz',
      stellarNetwork: 'testnet',
      budgetLimit: 10,
      contractId: 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses cached registry when cache is fresh (< 1 hour old)', async () => {
    const cachedApis = [
      {
        name: 'Cached API',
        slug: 'cached',
        description: 'From cache',
        category: 'Data',
        priceUsdc: 0.001,
        endpoint: '/api/proxy/cached',
        method: 'GET' as const,
        provider: 'TestProvider',
      },
    ];
    readRegistryCache.mockReturnValue({
      cachedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      apis: cachedApis,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await refreshRegistry('https://agentmarket.xyz');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'cached' }));
  });

  it('fetches from discovery endpoint when cache is stale (> 1 hour old)', async () => {
    readRegistryCache.mockReturnValue({
      cachedAt: Date.now() - 90 * 60 * 1000, // 90 minutes ago — stale
      apis: [],
    });
    const freshApis = [
      {
        slug: 'fresh-api',
        name: 'Fresh API',
        description: 'From network',
        category: 'Data',
        price: { amount: 0.002, asset: 'USDC' },
        endpoint: '/api/proxy/fresh-api',
        method: 'GET',
        input: { params: [], schema: null, example: {} },
        output: { schema: null, example: {} },
        reliability: { sideEffects: 'read', latency: 'fast', idempotent: true, successRate: 99 },
        provider: { name: 'TestProvider', stellarAddress: 'GTEST' },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ version: '1', total: 1, apis: freshApis }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await refreshRegistry('https://agentmarket.xyz');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://agentmarket.xyz/api/agents/discover'
    );
    expect(writeRegistryCache).toHaveBeenCalled();
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'fresh-api' }));
  });

  it('falls back to static registry when fetch fails', async () => {
    readRegistryCache.mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await refreshRegistry('https://agentmarket.xyz');

    // Static fallback has 'weather'
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'weather' }));
    expect(writeRegistryCache).not.toHaveBeenCalled();
  });

  it('falls back to static registry when discovery response has no apis array', async () => {
    readRegistryCache.mockReturnValue(null);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'service down' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await refreshRegistry('https://agentmarket.xyz');

    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'weather' }));
  });
});
```

- [ ] **Step 3: Run tests — verify new tests FAIL (TDD gate)**

```bash
cd cli
npm run test
```

Expected: the 4 new `refreshRegistry` tests fail with "refreshRegistry is not a function" or similar.

- [ ] **Step 4: Rewrite `cli/src/api.ts` to implement `refreshRegistry()`**

Replace the entire file with:

```typescript
/**
 * AgentMarket CLI - API Client
 */

import { loadConfig, appendHistory, readRegistryCache, writeRegistryCache } from './config';
import { StellarClient } from './stellar';
import { ApiInfo, CallResult } from './types';

const REGISTRY_TTL_MS = 60 * 60 * 1000 // 1 hour

// Static fallback — used when discovery fetch fails or on first run
const FALLBACK_REGISTRY: ApiInfo[] = [
  {
    name: 'Weather',
    slug: 'weather',
    description: 'Get current weather data for any city worldwide',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/weather',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Air Quality',
    slug: 'air-quality',
    description: 'Get real-time air quality index and pollution data',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/air-quality',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'News',
    slug: 'news',
    description: 'Fetch latest news headlines by topic',
    category: 'Data',
    priceUsdc: 0.002,
    endpoint: '/api/proxy/news',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Currency Exchange',
    slug: 'currency',
    description: 'Convert between currencies with live rates',
    category: 'Finance',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/currency',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Geolocation',
    slug: 'geolocation',
    description: 'Get location data from IP address',
    category: 'Geo',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/geolocation',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'AI Inference',
    slug: 'ai',
    description: 'Run AI inference queries (GPT, Claude)',
    category: 'AI',
    priceUsdc: 0.005,
    endpoint: '/api/proxy/ai',
    method: 'POST',
    provider: 'AgentMarket',
  },
];

// Module-level registry — reads from this for all sync operations
let _registry: ApiInfo[] = [...FALLBACK_REGISTRY];

interface DiscoverEntry {
  slug: string
  name: string
  description: string
  category: string
  price: { amount: number; asset: string }
  endpoint: string
  method: string
  provider: { name: string; stellarAddress: string }
}

function toApiInfo(entry: DiscoverEntry): ApiInfo {
  return {
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    category: entry.category,
    priceUsdc: entry.price.amount,
    endpoint: entry.endpoint,
    method: entry.method === 'POST' ? 'POST' : 'GET',
    provider: entry.provider.name,
  }
}

/**
 * Refresh the in-memory registry from the discovery endpoint.
 * Uses a 1-hour cache in ~/.agentmarket/registry.json.
 * Falls back to FALLBACK_REGISTRY silently on any error.
 */
export async function refreshRegistry(marketplaceUrl: string): Promise<void> {
  // 1. Check cache
  const cached = readRegistryCache()
  if (cached && Date.now() - cached.cachedAt < REGISTRY_TTL_MS) {
    _registry = cached.apis
    return
  }

  // 2. Fetch from discovery endpoint
  try {
    const res = await fetch(`${marketplaceUrl}/api/agents/discover`)
    if (!res.ok) return // stay on current _registry (fallback)
    const body = await res.json() as { apis?: DiscoverEntry[] }
    if (!Array.isArray(body.apis) || body.apis.length === 0) return

    const fresh = body.apis.map(toApiInfo)
    writeRegistryCache(fresh)
    _registry = fresh
  } catch {
    // Network error — stay on current _registry (fallback)
    // stderr warning intentionally omitted: callers handle UX
  }
}

export function listApis(category?: string): ApiInfo[] {
  if (category) {
    return _registry.filter(
      (api) => api.category.toLowerCase() === category.toLowerCase()
    );
  }
  return _registry;
}

export function getApiInfo(slug: string): ApiInfo | undefined {
  return _registry.find((api) => api.slug === slug);
}

function buildRequest(
  api: ApiInfo,
  baseUrl: string,
  params: Record<string, unknown>,
  headers: Record<string, string> = {}
): { url: string; init: RequestInit } {
  const url = new URL(api.endpoint, baseUrl);

  if (api.method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return { url: url.toString(), init: { method: 'GET', headers } };
  }

  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(params),
    },
  };
}

export async function callApi(
  slug: string,
  params: Record<string, unknown>,
  stellarClient: StellarClient
): Promise<CallResult> {
  const startTime = Date.now();
  const api = getApiInfo(slug);

  if (!api) {
    return { success: false, error: `API not found: ${slug}` };
  }

  const config = loadConfig();

  const wallet = await stellarClient.getWalletInfo();
  if (!wallet) {
    return { success: false, error: 'Wallet not configured. Run: agentmarket init' };
  }

  const usdcBalance = parseFloat(wallet.usdcBalance);
  if (usdcBalance < api.priceUsdc) {
    return {
      success: false,
      error: `Insufficient USDC balance. Need ${api.priceUsdc}, have ${usdcBalance}`,
    };
  }

  const baseUrl = config.marketplaceUrl;
  const initialRequest = buildRequest(api, baseUrl, params);

  try {
    const initialResponse = await fetch(initialRequest.url, initialRequest.init);

    if (initialResponse.status === 402) {
      const paymentDetails = await initialResponse.json() as {
        payment?: { recipient?: string; amount?: string; memo?: string };
      };

      if (!paymentDetails.payment?.recipient || !paymentDetails.payment?.amount) {
        return { success: false, error: 'Invalid 402 response: missing payment recipient or amount' };
      }

      const recipient = paymentDetails.payment.recipient;
      const amount = paymentDetails.payment.amount;
      const memo = paymentDetails.payment?.memo || `am:${slug}:${Date.now()}`;

      const paymentResult = await stellarClient.sendPayment(recipient, amount, memo);

      if (!paymentResult?.success) {
        return { success: false, error: 'Payment failed' };
      }

      const paymentProof = JSON.stringify({
        txHash: paymentResult.txHash,
        network: config.stellarNetwork,
        timestamp: Date.now(),
      });

      const retryRequest = buildRequest(api, baseUrl, params, {
        'X-Payment-Proof': paymentProof,
        'X-Payment-TxHash': paymentResult.txHash,
        'X-Payment-Network': config.stellarNetwork,
      });

      const retryResponse = await fetch(retryRequest.url, retryRequest.init);

      if (!retryResponse.ok) {
        return {
          success: false,
          error: `API call failed: ${retryResponse.status}`,
          txHash: paymentResult.txHash,
          amountPaid: api.priceUsdc,
        };
      }

      const data = await retryResponse.json();
      const latencyMs = Date.now() - startTime;

      appendHistory({
        api: slug,
        timestamp: new Date().toISOString(),
        amount: api.priceUsdc,
        txHash: paymentResult.txHash,
      });

      return { success: true, data, txHash: paymentResult.txHash, amountPaid: api.priceUsdc, latencyMs };
    }

    if (initialResponse.ok) {
      const data = await initialResponse.json();
      return { success: true, data, latencyMs: Date.now() - startTime };
    }

    return { success: false, error: `Unexpected response: ${initialResponse.status}` };
  } catch (error) {
    return {
      success: false,
      error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
```

- [ ] **Step 5: Run all tests — verify all 7 pass**

```bash
cd cli
npm run test
```

Expected output:
```
✓ CLI API client > lists APIs by category and preserves canonical methods
✓ CLI API client > returns a clear error when no wallet is configured
✓ CLI API client > completes the 402 payment retry flow and records history
✓ refreshRegistry > uses cached registry when cache is fresh (< 1 hour old)
✓ refreshRegistry > fetches from discovery endpoint when cache is stale (> 1 hour old)
✓ refreshRegistry > falls back to static registry when fetch fails
✓ refreshRegistry > falls back to static registry when discovery response has no apis array

Test Files  1 passed (1)
Tests       7 passed (7)
```

- [ ] **Step 6: Commit**

```bash
git add cli/src/api.ts cli/src/api.test.ts
git commit -m "feat(cli): replace static registry with dynamic discovery + 1h cache"
```

---

## Task 5: Wire `refreshRegistry` into CLI commands

**Files:**
- Modify: `cli/src/cli.ts`

The `list` and `call` commands need to call `refreshRegistry()` before accessing the registry. Both commands already have access to `loadConfig()`.

- [ ] **Step 1: Update the `list` command in `cli/src/cli.ts`**

Add `refreshRegistry` to the import at the top of the file:

```typescript
import { listApis, getApiInfo, callApi, refreshRegistry } from './api';
```

Find the `list` command action (currently sync). Change it to async and add the refresh call:

```typescript
// BEFORE:
.action((options) => {
  const apis = listApis(options.category);

// AFTER:
.action(async (options) => {
  const config = loadConfig();
  await refreshRegistry(config.marketplaceUrl);
  const apis = listApis(options.category);
```

- [ ] **Step 2: Update the `call` command in `cli/src/cli.ts`**

Find the `call` command action. It is already async. Add `refreshRegistry` before `getApiInfo`:

```typescript
// Find this pattern inside the call command action (it already starts with async):
const config = loadConfig();
// ADD this line immediately after loadConfig():
await refreshRegistry(config.marketplaceUrl);
```

- [ ] **Step 3: Type-check the CLI**

```bash
cd cli
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add cli/src/cli.ts
git commit -m "feat(cli): call refreshRegistry before list and call commands"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run CLI tests one final time**

```bash
cd cli
npm run test
```

Expected: 7 tests pass.

- [ ] **Step 2: Type-check agentmarket and web**

```bash
cd agentmarket && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

Expected: zero errors in both.

- [ ] **Step 3: Lint both**

```bash
cd agentmarket && npm run lint
cd ../web && npm run lint
```

Expected: zero warnings or errors.

- [ ] **Step 4: (Optional) Smoke test with servers running**

```bash
# Terminal 1
cd agentmarket && npm run dev

# Terminal 2
cd web && npm run dev

# Terminal 3 — test the raw backend
curl -s http://localhost:3001/api/agents/discover | jq '{total: .total, first_slug: .apis[0].slug, network: .paymentNetwork}'

# Test the web proxy
curl -s http://localhost:3000/api/agents/discover | jq '{total: .total, first_slug: .apis[0].slug}'
```

Expected:
```json
{
  "total": 7,
  "first_slug": "weather",
  "network": "testnet"
}
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| Dedicated `/api/agents/discover` route in agentmarket | Task 1 |
| Agent-optimized JSON shape (slug, price, input, output, reliability, provider) | Task 1 |
| `paymentNetwork` dynamic from env | Task 1 (`process.env.STELLAR_NETWORK`) |
| DB → fallback catalog fallback | Task 1 |
| Web proxy at `/api/agents/discover` | Task 2 |
| 502 error when agentmarket unreachable | Task 2 |
| `readRegistryCache` / `writeRegistryCache` in config | Task 3 |
| `refreshRegistry()` with 1h TTL cache | Task 4 |
| `refreshRegistry()` fetches from `/api/agents/discover` | Task 4 |
| Falls back to static registry on error | Task 4 |
| `listApis` / `getApiInfo` remain sync | Task 4 |
| `list` and `call` CLI commands refresh before use | Task 5 |
| All existing CLI tests still pass | Task 4 step 5 |
