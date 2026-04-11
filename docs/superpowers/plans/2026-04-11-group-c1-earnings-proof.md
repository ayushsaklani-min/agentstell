# C1: Provider Earnings Proof — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/api/provider/earnings-proof` endpoint that returns a verifiable JSON document of a provider's on-chain earnings, plus an Earnings Proof tab in the provider dashboard.

**Architecture:** Backend route queries `ApiCall` records via Prisma filtered by provider and date range, assembles a proof document with individual txHashes. Web proxy forwards to the backend. Provider dashboard gains a new `'earnings'` tab with a period selector, summary stats, breakdown table, and Download/Share buttons.

**Tech Stack:** Next.js App Router, Prisma (SQLite), lucide-react icons, existing `Badge`/`StatCard`/`EmptyState` primitives in `web/src/app/provider/page.tsx`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `agentmarket/src/app/api/provider/earnings-proof/route.ts` | Query Prisma, build proof document, return JSON |
| Create | `web/src/app/api/provider/earnings-proof/route.ts` | Thin proxy to agentmarket backend |
| Modify | `web/src/app/provider/page.tsx` | Add `'earnings'` tab + `EarningsProofTab` component |

---

## Task 1: Backend earnings-proof route

**Files:**
- Create: `agentmarket/src/app/api/provider/earnings-proof/route.ts`

- [ ] **Step 1: Create the route file**

Create `agentmarket/src/app/api/provider/earnings-proof/route.ts` with this exact content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim()
  const daysParam = request.nextUrl.searchParams.get('days') ?? '30'

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 })
  }

  const days = parseInt(daysParam, 10)
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 })
  }

  try {
    const prisma = getPrismaClient()

    const provider = await prisma.provider.findUnique({
      where: { stellarAddress: address },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const calls = await prisma.apiCall.findMany({
      where: {
        apiListing: { providerId: provider.id },
        createdAt: { gte: since },
      },
      include: {
        apiListing: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const network = process.env.STELLAR_NETWORK ?? 'testnet'
    const explorerBase =
      network === 'mainnet'
        ? 'https://stellarchain.io/tx/'
        : 'https://testnet.stellarchain.io/tx/'

    // Build per-slug breakdown (successful calls only for earnings)
    const breakdownMap = new Map<string, { calls: number; earningsUsdc: number }>()
    for (const call of calls) {
      const slug = call.apiListing.slug
      const entry = breakdownMap.get(slug) ?? { calls: 0, earningsUsdc: 0 }
      entry.calls++
      if (call.success) {
        entry.earningsUsdc =
          Math.round((entry.earningsUsdc + call.amountUsdc) * 1e6) / 1e6
      }
      breakdownMap.set(slug, entry)
    }

    const breakdown = Array.from(breakdownMap.entries())
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => b.earningsUsdc - a.earningsUsdc)

    const successfulCalls = calls.filter((c) => c.success)
    const totalEarningsUsdc =
      Math.round(
        successfulCalls.reduce((s, c) => s + c.amountUsdc, 0) * 1e6
      ) / 1e6

    return NextResponse.json({
      provider: address,
      generatedAt: new Date().toISOString(),
      periodDays: days,
      totalEarningsUsdc,
      callCount: calls.length,
      successfulCalls: successfulCalls.length,
      breakdown,
      transactions: calls.map((c) => ({
        txHash: c.txHash,
        apiSlug: c.apiListing.slug,
        amountUsdc: c.amountUsdc,
        timestamp: c.createdAt.toISOString(),
        success: c.success,
      })),
      stellarExplorerBase: explorerBase,
    })
  } catch (error) {
    console.error('Earnings proof error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add agentmarket/src/app/api/provider/earnings-proof/route.ts
git commit -m "feat(agentmarket): add provider earnings-proof endpoint"
```

---

## Task 2: Web proxy for earnings-proof

**Files:**
- Create: `web/src/app/api/provider/earnings-proof/route.ts`

- [ ] **Step 1: Create the proxy**

The pattern is identical to `web/src/app/api/provider/dashboard/route.ts`. Create `web/src/app/api/provider/earnings-proof/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search

  try {
    const response = await fetch(
      new URL(`/api/provider/earnings-proof${search}`, getBackendBaseUrl())
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
        error: 'AgentMarket backend unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/provider/earnings-proof/route.ts
git commit -m "feat(web): add earnings-proof proxy route"
```

---

## Task 3: Earnings Proof tab in provider dashboard

**Files:**
- Modify: `web/src/app/provider/page.tsx`

The provider page already has these patterns:
- `ProviderTab = 'overview' | 'apis' | 'register' | 'calls' | 'settings'` (line 35)
- `TABS` array (line 693) with `{ id, label, icon }` entries
- Tab content switch in the JSX (lines 974–986)
- Existing primitives: `Badge`, `EmptyState`, `fmt$`, `fmtCompact`, `truncateAddress`
- Imports already include: `Shield`, `Download` is NOT imported — add `FileText` from lucide-react

- [ ] **Step 1: Add `'earnings'` to `ProviderTab` type**

Find line 35:
```typescript
type ProviderTab = 'overview' | 'apis' | 'register' | 'calls' | 'settings'
```

Change to:
```typescript
type ProviderTab = 'overview' | 'apis' | 'register' | 'calls' | 'settings' | 'earnings'
```

- [ ] **Step 2: Add `FileText` to lucide-react imports**

Find the lucide-react import block (lines 13–31). Add `FileText` to it:
```typescript
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Shield,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
  Plus,
  List,
  Settings,
  BarChart3,
} from 'lucide-react'
```

- [ ] **Step 3: Add `'earnings'` entry to `TABS` array**

Find the `TABS` array (around line 693):
```typescript
const TABS: { id: ProviderTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'apis', label: 'APIs', icon: List },
  { id: 'register', label: 'Register API', icon: Plus },
  { id: 'calls', label: 'Calls', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
]
```

Change to:
```typescript
const TABS: { id: ProviderTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'apis', label: 'APIs', icon: List },
  { id: 'register', label: 'Register API', icon: Plus },
  { id: 'calls', label: 'Calls', icon: Activity },
  { id: 'earnings', label: 'Earnings Proof', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]
```

- [ ] **Step 4: Add `EarningsProofTab` component**

Add this component immediately before the `// ─── Main Page ───` comment (around line 691):

```typescript
// ─── Earnings Proof Tab ───────────────────────────────────────────────────────

interface EarningsProof {
  provider: string
  generatedAt: string
  periodDays: number
  totalEarningsUsdc: number
  callCount: number
  successfulCalls: number
  breakdown: { slug: string; calls: number; earningsUsdc: number }[]
  transactions: { txHash: string; apiSlug: string; amountUsdc: number; timestamp: string; success: boolean }[]
  stellarExplorerBase: string
}

function EarningsProofTab({ providerAddress }: { providerAddress: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [proof, setProof] = useState<EarningsProof | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchProof = useCallback(async (d: number) => {
    if (!providerAddress) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/provider/earnings-proof?address=${encodeURIComponent(providerAddress)}&days=${d}`
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to load earnings proof')
      setProof(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load earnings proof')
    } finally {
      setLoading(false)
    }
  }, [providerAddress])

  useEffect(() => { void fetchProof(days) }, [days, fetchProof])

  const handleDownload = () => {
    if (!proof) return
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earnings-proof-${providerAddress.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/api/provider/earnings-proof?address=${encodeURIComponent(providerAddress)}&days=${days}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!providerAddress) {
    return <EmptyState icon={FileText} title="No provider connected" body="Enter your Stellar address to view your earnings proof." />
  }

  return (
    <div className="space-y-5">
      {/* Header + period picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Earnings Proof</h2>
          <p className="text-xs text-gray-400 mt-0.5">Verifiable record of on-chain payments received</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                days === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={() => fetchProof(days)} className="ml-3 text-xs font-medium underline">Retry</button>
        </div>
      ) : proof ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <p className="text-lg font-bold text-emerald-700">{fmt$(proof.totalEarningsUsdc)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total earned (USDC)</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <p className="text-lg font-bold text-gray-900">{proof.callCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total calls</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <p className="text-lg font-bold text-gray-900">{proof.successfulCalls}</p>
              <p className="text-xs text-gray-400 mt-0.5">Successful calls</p>
            </div>
          </div>

          {/* Breakdown table */}
          {proof.breakdown.length > 0 && (
            <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Per-API Breakdown</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {proof.breakdown.map((row) => (
                  <div key={row.slug} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 font-mono">{row.slug}</p>
                      <p className="text-xs text-gray-400">{row.calls} calls</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">{fmt$(row.earningsUsdc)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions preview */}
          {proof.transactions.length > 0 && (
            <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Transactions ({proof.transactions.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {proof.transactions.slice(0, 20).map((tx) => (
                  <div key={tx.txHash} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${tx.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <a
                        href={proof.stellarExplorerBase + tx.txHash}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-indigo-600 hover:text-indigo-800 truncate"
                      >
                        {tx.txHash.slice(0, 16)}…
                      </a>
                    </div>
                    <span className="text-xs font-mono text-gray-500 flex-shrink-0 ml-2">{fmt$(tx.amountUsdc)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              <FileText className="h-4 w-4" /> Download JSON
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Share Link'}
            </button>
          </div>

          <p className="text-[11px] text-gray-400">
            Generated {new Date(proof.generatedAt).toLocaleString()} · Last {proof.periodDays} days · Each txHash is independently verifiable on Stellar
          </p>
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Wire the tab into the tab content switch**

Find the tab content block (around line 974):
```tsx
{activeTab === 'calls' && <CallsTab dashboard={dashboard} />}
{activeTab === 'settings' && <SettingsTab dashboard={dashboard} />}
```

Add the earnings tab between calls and settings:
```tsx
{activeTab === 'calls' && <CallsTab dashboard={dashboard} />}
{activeTab === 'earnings' && <EarningsProofTab providerAddress={providerAddress} />}
{activeTab === 'settings' && <SettingsTab dashboard={dashboard} />}
```

- [ ] **Step 6: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/provider/page.tsx
git commit -m "feat(web): add Earnings Proof tab to provider dashboard"
```

---

## Task 4: Final verification

- [ ] **Step 1: agentmarket typecheck + lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 2: web typecheck + lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Confirm git log**

```bash
git log --oneline -5
```

Expected: 3 new C1 commits visible.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `GET /api/provider/earnings-proof?address=&days=` | Task 1 |
| `address` missing → 400 | Task 1 |
| `days` invalid → 400 | Task 1 |
| Provider not found → 404 | Task 1 |
| No calls in period → 200 with empty arrays | Task 1 |
| DB unavailable → 503 | Task 1 |
| Failed calls in transactions but excluded from earnings | Task 1 |
| `breakdown` sorted by earningsUsdc descending | Task 1 |
| `stellarExplorerBase` field in response | Task 1 |
| Web proxy forwards search params | Task 2 |
| `'earnings'` tab in provider dashboard | Task 3 |
| Period selector (7/30/90 days) | Task 3 |
| Summary stats display | Task 3 |
| Per-API breakdown table | Task 3 |
| Download JSON button | Task 3 |
| Copy Share Link button | Task 3 |
