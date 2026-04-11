# C3: API Health Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand health checks for marketplace listings with a 5-minute DB cache, and show coloured dot badges on each marketplace card.

**Architecture:** Three new optional fields added to `ApiListing` via Prisma migration. Backend route pings the upstream URL (3s timeout), classifies the result, writes to DB, returns JSON. Web proxy forwards. Marketplace page fires parallel health fetches on mount and updates a `healthMap` state keyed by slug.

**Tech Stack:** Next.js App Router, Prisma (SQLite), `AbortController` for timeout, existing marketplace page state patterns.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `agentmarket/prisma/schema.prisma` | Add `healthStatus`, `healthCheckedAt`, `healthLatencyMs` to `ApiListing` |
| Create | `agentmarket/src/app/api/health/[slug]/route.ts` | Cache check + upstream ping + DB write + response |
| Create | `web/src/app/api/health/[slug]/route.ts` | Thin proxy to agentmarket backend |
| Modify | `web/src/app/marketplace/page.tsx` | `healthMap` state, parallel fetches on mount, dot badge on cards |

---

## Task 1: DB migration + backend health route

**Files:**
- Modify: `agentmarket/prisma/schema.prisma`
- Create: `agentmarket/src/app/api/health/[slug]/route.ts`

- [ ] **Step 1: Add health fields to `ApiListing` in schema**

Open `agentmarket/prisma/schema.prisma`. Find the `ApiListing` model. After the `isFeatured Boolean @default(false)` line, add three new optional fields:

```prisma
  // Health monitoring
  healthStatus    String?
  healthCheckedAt DateTime?
  healthLatencyMs Int?
```

The `ApiListing` model's status block should look like:
```prisma
  // Status
  isActive     Boolean    @default(true)
  isProxied    Boolean    @default(false)
  isFeatured   Boolean    @default(false)

  // Health monitoring
  healthStatus    String?
  healthCheckedAt DateTime?
  healthLatencyMs Int?
```

- [ ] **Step 2: Run migration**

```bash
cd agentmarket && npx prisma migrate dev --name add-listing-health
```

Expected output includes: `The following migration(s) have been created and applied` and `✔ Generated Prisma Client`.

- [ ] **Step 3: Create the health check route**

Create `agentmarket/src/app/api/health/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutes
const TIMEOUT_MS   = 3000             // 3 seconds

type HealthStatus = 'healthy' | 'degraded' | 'down'

function classify(ok: boolean, latencyMs: number): HealthStatus {
  if (!ok) return 'down'
  if (latencyMs >= 1000) return 'degraded'
  return 'healthy'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const prisma = getPrismaClient()
    const listing = await prisma.apiListing.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        endpoint: true,
        healthStatus: true,
        healthCheckedAt: true,
        healthLatencyMs: true,
      },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Return cached result if fresh
    if (
      listing.healthCheckedAt &&
      listing.healthStatus &&
      Date.now() - listing.healthCheckedAt.getTime() < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        slug,
        status: listing.healthStatus,
        latencyMs: listing.healthLatencyMs,
        checkedAt: listing.healthCheckedAt.toISOString(),
        cached: true,
      })
    }

    // Live ping
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const startedAt = Date.now()

    let ok = false
    let latencyMs = TIMEOUT_MS

    try {
      const response = await fetch(listing.endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      latencyMs = Date.now() - startedAt
      ok = response.ok
    } catch {
      latencyMs = Date.now() - startedAt
      ok = false
    } finally {
      clearTimeout(timeoutId)
    }

    const status: HealthStatus = classify(ok, latencyMs)
    const checkedAt = new Date()

    // Write result back to DB (best-effort — don't fail the response if write fails)
    try {
      await prisma.apiListing.update({
        where: { id: listing.id },
        data: {
          healthStatus: status,
          healthCheckedAt: checkedAt,
          healthLatencyMs: latencyMs,
        },
      })
    } catch (writeError) {
      console.error('Health check DB write failed:', writeError)
    }

    return NextResponse.json({
      slug,
      status,
      latencyMs,
      checkedAt: checkedAt.toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
```

- [ ] **Step 4: Type-check and lint**

```bash
cd agentmarket && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add agentmarket/prisma/schema.prisma agentmarket/prisma/migrations agentmarket/src/app/api/health/[slug]/route.ts
git commit -m "feat(agentmarket): add health check endpoint with 5-minute DB cache"
```

---

## Task 2: Web proxy for health endpoint

**Files:**
- Create: `web/src/app/api/health/[slug]/route.ts`

- [ ] **Step 1: Create the proxy**

Create `web/src/app/api/health/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const response = await fetch(new URL(`/api/health/${slug}`, getBackendBaseUrl()))
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Backend unavailable', details: error instanceof Error ? error.message : 'Unknown error' },
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
git add web/src/app/api/health/[slug]/route.ts
git commit -m "feat(web): add health check proxy route"
```

---

## Task 3: Health badges on marketplace page

**Files:**
- Modify: `web/src/app/marketplace/page.tsx`

The marketplace page currently:
- Fetches `apis: MarketplaceApi[]` on mount (each has a `slug` field)
- Renders a grid of cards inside `filtered.map((api) => ...)`
- Has state: `search`, `category`, `apis`, `stats`, `loading`, `error`

- [ ] **Step 1: Add `healthMap` state and fetch logic**

Find the existing state declarations (around lines 44–49):
```typescript
const [search, setSearch] = useState('')
const [category, setCategory] = useState('All')
const [apis, setApis] = useState<MarketplaceApi[]>([])
const [stats, setStats] = useState<MarketplaceStats | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

Add `healthMap` state after `error`:
```typescript
const [healthMap, setHealthMap] = useState<Record<string, 'healthy' | 'degraded' | 'down' | 'unknown' | 'loading'>>({})
```

Then find the `useEffect` that calls `load()` (around lines 51–68). After the `load()` function definition but still inside the `useEffect`, add health fetching triggered after `apis` are loaded. Instead, add a **separate** `useEffect` that watches `apis` and fires health checks:

Add this block immediately after the existing `useEffect(() => { load() }, [])`:

```typescript
useEffect(() => {
  if (apis.length === 0) return
  // initialise all to 'loading'
  setHealthMap(Object.fromEntries(apis.map((a) => [a.slug, 'loading'])))
  // fire parallel health checks
  for (const api of apis) {
    fetch(`/api/health/${api.slug}`)
      .then((r) => r.json())
      .then((data: { status?: string }) => {
        setHealthMap((prev) => ({
          ...prev,
          [api.slug]: (data.status as 'healthy' | 'degraded' | 'down') ?? 'unknown',
        }))
      })
      .catch(() => {
        setHealthMap((prev) => ({ ...prev, [api.slug]: 'unknown' }))
      })
  }
}, [apis])
```

- [ ] **Step 2: Add `HealthDot` helper component**

Add this function immediately before the `export default function MarketplacePage()` line:

```typescript
function HealthDot({ status }: { status: 'healthy' | 'degraded' | 'down' | 'unknown' | 'loading' | undefined }) {
  const map: Record<string, string> = {
    healthy:  'bg-emerald-400',
    degraded: 'bg-amber-400',
    down:     'bg-red-400',
    unknown:  'bg-gray-300',
    loading:  'bg-gray-300 animate-pulse',
  }
  const label: Record<string, string> = {
    healthy:  'Healthy',
    degraded: 'Degraded',
    down:     'Down',
    unknown:  'Unknown',
    loading:  'Checking…',
  }
  const s = status ?? 'unknown'
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${map[s] ?? map.unknown}`}
      title={label[s] ?? 'Unknown'}
    />
  )
}
```

- [ ] **Step 3: Add health badge to each listing card**

Find the card's top row inside `filtered.map((api) => ...)` (around line 178):
```tsx
<div className="mb-4 flex items-start justify-between">
  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradPart}`}>
    <span className={`text-[10px] font-black tracking-widest ${textPart}`}>
      {api.icon || api.name.slice(0, 2).toUpperCase()}
    </span>
  </div>
  <div className="text-right">
    <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
      ${api.priceUsdc.toFixed(3)}/call
    </span>
  </div>
</div>
```

Change to add the `HealthDot` in the top-right corner alongside the price badge:
```tsx
<div className="mb-4 flex items-start justify-between">
  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradPart}`}>
    <span className={`text-[10px] font-black tracking-widest ${textPart}`}>
      {api.icon || api.name.slice(0, 2).toUpperCase()}
    </span>
  </div>
  <div className="flex items-center gap-2 text-right">
    <HealthDot status={healthMap[api.slug]} />
    <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
      ${api.priceUsdc.toFixed(3)}/call
    </span>
  </div>
</div>
```

- [ ] **Step 4: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/marketplace/page.tsx
git commit -m "feat(web): add health status badges to marketplace listing cards"
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
git log --oneline -6
```

Expected: 4 new C3 commits visible.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `healthStatus`, `healthCheckedAt`, `healthLatencyMs` on `ApiListing` | Task 1 |
| DB migration runs | Task 1 |
| Cache hit (< 5 min) returns immediately with `cached: true` | Task 1 |
| Cache miss pings upstream with 3s timeout | Task 1 |
| `healthy` = 2xx < 1000ms | Task 1 |
| `degraded` = 2xx ≥ 1000ms | Task 1 |
| `down` = non-2xx or timeout | Task 1 |
| DB write failure logged but response still returned | Task 1 |
| 404 when listing not found | Task 1 |
| Response includes `slug`, `status`, `latencyMs`, `checkedAt`, `cached` | Task 1 |
| Web proxy for `GET /api/health/[slug]` | Task 2 |
| `healthMap` state initialised to `'loading'` on mount | Task 3 |
| Parallel health fetches fired for all listings | Task 3 |
| `HealthDot` shows green/yellow/red/gray dot | Task 3 |
| Dot has `title` attribute with status + hint | Task 3 |
| Fetch error sets slug to `'unknown'` | Task 3 |
