# C2: Wanted Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Wanted Board where any Stellar address can post API requests with a budget, view open posts, and update post status — with a full UI page and nav link.

**Architecture:** New `WantedPost` Prisma model added via migration. Three agentmarket backend routes (GET/POST on `/api/wanted`, PATCH on `/api/wanted/[id]`) with two thin web proxies. New `web/src/app/wanted/page.tsx` two-panel page. Nav link added between Marketplace and Docs.

**Tech Stack:** Next.js App Router, Prisma (SQLite), `npx prisma migrate dev`, existing Nav/page patterns in `web/`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `agentmarket/prisma/schema.prisma` | Add `WantedPost` model |
| Create | `agentmarket/src/app/api/wanted/route.ts` | GET (list) + POST (create) |
| Create | `agentmarket/src/app/api/wanted/[id]/route.ts` | PATCH (update status) |
| Create | `web/src/app/api/wanted/route.ts` | Proxy GET + POST |
| Create | `web/src/app/api/wanted/[id]/route.ts` | Proxy PATCH |
| Create | `web/src/app/wanted/page.tsx` | Wanted board UI |
| Modify | `web/src/components/Nav.tsx` | Add Wanted nav link |

---

## Task 1: DB migration + backend GET/POST route

**Files:**
- Modify: `agentmarket/prisma/schema.prisma`
- Create: `agentmarket/src/app/api/wanted/route.ts`

- [ ] **Step 1: Add `WantedPost` model to schema**

Open `agentmarket/prisma/schema.prisma`. At the very end of the file, after the `MarketplaceStats` model, add:

```prisma
// Wanted Board — API requests from consumers
model WantedPost {
  id            String   @id @default(cuid())
  title         String
  description   String
  category      String
  budgetUsdc    Float
  posterAddress String
  status        String   @default("open")  // open | fulfilled | closed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
cd agentmarket && npx prisma migrate dev --name add-wanted-posts
```

Expected output includes: `The following migration(s) have been created and applied` and `✔ Generated Prisma Client`.

- [ ] **Step 3: Create the GET + POST route**

Create `agentmarket/src/app/api/wanted/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STELLAR_ADDRESS_RE = /^G[A-Z0-9]{55}$/

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? 'open'
  const category = request.nextUrl.searchParams.get('category')?.trim()

  try {
    const prisma = getPrismaClient()
    const posts = await prisma.wantedPost.findMany({
      where: {
        ...(status !== 'all' ? { status } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error('Wanted GET error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, category, budgetUsdc, posterAddress } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (title.trim().length > 120) {
      return NextResponse.json({ error: 'title must be 120 characters or fewer' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (description.trim().length > 1000) {
      return NextResponse.json({ error: 'description must be 1000 characters or fewer' }, { status: 400 })
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }
    if (typeof budgetUsdc !== 'number' || budgetUsdc <= 0) {
      return NextResponse.json({ error: 'budgetUsdc must be greater than 0' }, { status: 400 })
    }
    if (!posterAddress || !STELLAR_ADDRESS_RE.test(posterAddress)) {
      return NextResponse.json(
        { error: 'posterAddress must be a valid Stellar public key' },
        { status: 400 }
      )
    }

    const prisma = getPrismaClient()
    const post = await prisma.wantedPost.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        budgetUsdc,
        posterAddress,
      },
    })

    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error('Wanted POST error:', error)
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
git add agentmarket/prisma/schema.prisma agentmarket/prisma/migrations agentmarket/src/app/api/wanted/route.ts
git commit -m "feat(agentmarket): add WantedPost model and GET/POST /api/wanted route"
```

---

## Task 2: Backend PATCH route

**Files:**
- Create: `agentmarket/src/app/api/wanted/[id]/route.ts`

- [ ] **Step 1: Create the PATCH route**

Create `agentmarket/src/app/api/wanted/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['open', 'fulfilled', 'closed'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { status, posterAddress } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!posterAddress || typeof posterAddress !== 'string') {
      return NextResponse.json({ error: 'posterAddress is required' }, { status: 400 })
    }

    const prisma = getPrismaClient()
    const post = await prisma.wantedPost.findUnique({ where: { id } })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.posterAddress !== posterAddress) {
      return NextResponse.json(
        { error: 'Not authorised to update this post' },
        { status: 403 }
      )
    }

    const updated = await prisma.wantedPost.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Wanted PATCH error:', error)
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
git add agentmarket/src/app/api/wanted/[id]/route.ts
git commit -m "feat(agentmarket): add PATCH /api/wanted/[id] for status updates"
```

---

## Task 3: Web proxy routes

**Files:**
- Create: `web/src/app/api/wanted/route.ts`
- Create: `web/src/app/api/wanted/[id]/route.ts`

Both follow the identical pattern as `web/src/app/api/provider/dashboard/route.ts`.

- [ ] **Step 1: Create GET/POST proxy**

Create `web/src/app/api/wanted/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search
  try {
    const response = await fetch(new URL(`/api/wanted${search}`, getBackendBaseUrl()))
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const response = await fetch(new URL('/api/wanted', getBackendBaseUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, {
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

- [ ] **Step 2: Create PATCH proxy**

Create `web/src/app/api/wanted/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.text()
    const response = await fetch(new URL(`/api/wanted/${id}`, getBackendBaseUrl()), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, {
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

- [ ] **Step 3: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/wanted/route.ts web/src/app/api/wanted/[id]/route.ts
git commit -m "feat(web): add wanted board proxy routes"
```

---

## Task 4: Wanted board UI page

**Files:**
- Create: `web/src/app/wanted/page.tsx`

- [ ] **Step 1: Create the page**

Create `web/src/app/wanted/page.tsx`:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Nav } from '@/components/Nav'
import { AlertCircle, CheckCircle2, Clock, Loader2, Send } from 'lucide-react'

interface WantedPost {
  id: string
  title: string
  description: string
  category: string
  budgetUsdc: number
  posterAddress: string
  status: string
  createdAt: string
}

const CATEGORIES = ['Data', 'Finance', 'AI', 'Geo', 'Utilities', 'News', 'Weather', 'Agent', 'Other']
const STATUS_FILTERS = ['open', 'fulfilled', 'closed', 'all'] as const

const STELLAR_ADDRESS_RE = /^G[A-Z0-9]{55}$/

function fmtAge(iso: string) {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function statusBadge(status: string) {
  if (status === 'open') return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200/60">Open</span>
  if (status === 'fulfilled') return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-200/60">Fulfilled</span>
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200/60">Closed</span>
}

export default function WantedPage() {
  const [posts, setPosts] = useState<WantedPost[]>([])
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [budgetUsdc, setBudgetUsdc] = useState('')
  const [posterAddress, setPosterAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const loadPosts = useCallback(async (status: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/wanted?status=${status}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to load posts')
      setPosts(body.posts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPosts(statusFilter) }, [statusFilter, loadPosts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)

    const budget = parseFloat(budgetUsdc)
    if (isNaN(budget) || budget <= 0) {
      setSubmitError('Budget must be a positive number')
      return
    }
    if (!STELLAR_ADDRESS_RE.test(posterAddress)) {
      setSubmitError('Stellar address must start with G and be 56 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/wanted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, budgetUsdc: budget, posterAddress }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to post request')
      setTitle(''); setDescription(''); setBudgetUsdc(''); setSubmitSuccess(true)
      void loadPosts(statusFilter)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to post request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (post: WantedPost, newStatus: string) => {
    const res = await fetch(`/api/wanted/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, posterAddress }),
    })
    if (res.ok) void loadPosts(statusFilter)
  }

  return (
    <main className="min-h-screen bg-gray-50/60">
      <Nav />

      <div className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-8 pt-28">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-indigo-500">Community</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Wanted Board</h1>
          <p className="mt-1 text-sm text-gray-500">Post the APIs you need. Providers build what the market demands.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-5">

          {/* ── Post Form ──────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="font-bold text-gray-900">Post a Request</h2>
                <p className="text-xs text-gray-400 mt-0.5">Describe what you need. Providers will see this.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    required
                    placeholder="e.g. Real-time flight status API"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    required
                    rows={4}
                    placeholder="Describe the API, data format, use case…"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">Budget (USDC/call)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={budgetUsdc}
                      onChange={(e) => setBudgetUsdc(e.target.value)}
                      required
                      placeholder="0.005"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">Your Stellar Address</label>
                  <input
                    value={posterAddress}
                    onChange={(e) => setPosterAddress(e.target.value)}
                    required
                    placeholder="GDEMO..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Used to identify your posts. You need it to update status.</p>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /> {submitError}
                  </div>
                )}
                {submitSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Posted successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post Request
                </button>
              </form>
            </div>
          </div>

          {/* ── Post List ──────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Status filter tabs */}
            <div className="flex gap-1 rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-sm">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize transition-all ${
                    statusFilter === s
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                <AlertCircle className="h-5 w-5 flex-shrink-0" /> {error}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200/80 bg-white py-20 text-center shadow-sm">
                <Clock className="h-8 w-8 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-600">No {statusFilter === 'all' ? '' : statusFilter} posts yet</p>
                <p className="mt-1 text-xs text-gray-400">Be the first to post a request</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-gray-900 leading-snug">{post.title}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {statusBadge(post.status)}
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-mono text-xs font-bold text-indigo-700">
                          ${post.budgetUsdc.toFixed(3)}/call
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 leading-relaxed">{post.description}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{post.category}</span>
                      <span className="font-mono">{truncateAddress(post.posterAddress)}</span>
                      <span>{fmtAge(post.createdAt)}</span>
                    </div>
                    {posterAddress === post.posterAddress && post.status === 'open' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleStatusChange(post, 'fulfilled')}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                        >
                          Mark Fulfilled
                        </button>
                        <button
                          onClick={() => handleStatusChange(post, 'closed')}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200 transition"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/wanted/page.tsx
git commit -m "feat(web): add Wanted Board page"
```

---

## Task 5: Add Wanted link to Nav

**Files:**
- Modify: `web/src/components/Nav.tsx`

- [ ] **Step 1: Add Wanted to LINKS array**

Find the `LINKS` array (line 6):
```typescript
const LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/docs', label: 'Docs' },
  { href: '/demo', label: 'Live Demo' },
  { href: '/provider', label: 'Dashboard' },
]
```

Change to:
```typescript
const LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/wanted', label: 'Wanted' },
  { href: '/docs', label: 'Docs' },
  { href: '/demo', label: 'Live Demo' },
  { href: '/provider', label: 'Dashboard' },
]
```

- [ ] **Step 2: Type-check and lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Nav.tsx
git commit -m "feat(web): add Wanted nav link"
```

---

## Task 6: Final verification

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
git log --oneline -8
```

Expected: 5 new C2 commits visible.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `WantedPost` model in schema | Task 1 |
| DB migration runs | Task 1 |
| `GET /api/wanted` with `?status` and `?category` filters | Task 1 |
| `POST /api/wanted` with full validation | Task 1 |
| `title` max 120 chars | Task 1 |
| `description` max 1000 chars | Task 1 |
| `budgetUsdc` > 0 | Task 1 |
| `posterAddress` Stellar key format validated | Task 1 |
| `PATCH /api/wanted/[id]` with posterAddress auth | Task 2 |
| PATCH 403 when posterAddress mismatch | Task 2 |
| PATCH 404 when post not found | Task 2 |
| Valid status values enforced | Task 2 |
| Web GET+POST proxy | Task 3 |
| Web PATCH proxy | Task 3 |
| Two-panel layout (form left, list right) | Task 4 |
| Status filter tabs (All/Open/Fulfilled/Closed) | Task 4 |
| Status update buttons for own posts | Task 4 |
| Wanted nav link between Marketplace and Docs | Task 5 |
