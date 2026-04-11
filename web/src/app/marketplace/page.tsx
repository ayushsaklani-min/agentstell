'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/Nav'
import { AlertCircle, ArrowRight, Filter, Loader2, Search, Zap } from 'lucide-react'

interface MarketplaceApi {
  id: string
  slug: string
  name: string
  icon: string
  category: string
  description: string
  priceUsdc: number
  totalCalls: number
  providerName: string
}

interface MarketplaceStats {
  totalApis: number
  totalProviders: number
  totalCalls: number
  averagePriceUsdc: number
}

const CATEGORIES = ['All', 'Data', 'Finance', 'AI', 'Geo', 'Utilities', 'News', 'Weather', 'Agent']

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

const CATEGORY_COLORS: Record<string, string> = {
  AI: 'from-violet-50 to-purple-50 text-violet-600',
  Finance: 'from-emerald-50 to-green-50 text-emerald-600',
  Data: 'from-blue-50 to-sky-50 text-blue-600',
  Geo: 'from-rose-50 to-pink-50 text-rose-600',
  Weather: 'from-sky-50 to-cyan-50 text-sky-600',
  News: 'from-orange-50 to-amber-50 text-orange-600',
  Utilities: 'from-gray-50 to-slate-50 text-gray-600',
}

function fmtCompact(v: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [apis, setApis] = useState<MarketplaceApi[]>([])
  const [stats, setStats] = useState<MarketplaceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healthMap, setHealthMap] = useState<Record<string, 'healthy' | 'degraded' | 'down' | 'unknown' | 'loading'>>({})

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/marketplace')
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Failed to load marketplace')
        setApis(body.apis ?? [])
        setStats(body.stats ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load marketplace')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return apis.filter((api) => {
      const matchSearch = api.name.toLowerCase().includes(q) || api.description.toLowerCase().includes(q)
      const matchCat = category === 'All' || api.category === category
      return matchSearch && matchCat
    })
  }, [apis, search, category])

  return (
    <main className="min-h-screen bg-gray-50/60">
      <Nav />

      {/* Hero header */}
      <div className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-8 pt-28">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-indigo-500">Marketplace</p>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">API Marketplace</h1>
              <p className="mt-1.5 text-sm text-gray-500">Pay-per-call APIs for AI agents. No subscriptions. No API keys.</p>
            </div>
            <Link href="/provider" className="hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 md:flex">
              <Zap className="h-4 w-4" /> Publish Your API
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total APIs', value: stats ? String(stats.totalApis) : '—' },
              { label: 'Total Calls', value: stats ? fmtCompact(stats.totalCalls) : '—' },
              { label: 'Avg Price', value: stats ? `$${stats.averagePriceUsdc.toFixed(3)}` : '—' },
              { label: 'Providers', value: stats ? String(stats.totalProviders) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-lg font-bold text-indigo-600">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Search + filter */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search APIs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <Filter className="h-4 w-4 flex-shrink-0 text-gray-400" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  category === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
              <p className="mt-3 text-sm text-gray-400">Loading marketplace…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 py-16 text-red-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700">No APIs found</p>
            <p className="mt-1 text-xs text-gray-400">Try adjusting your search or filter</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-gray-400">{filtered.length} API{filtered.length !== 1 ? 's' : ''} found</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((api) => {
                const colorClass = CATEGORY_COLORS[api.category] ?? CATEGORY_COLORS.Utilities
                const [gradPart, textPart] = colorClass.split(' ').reduce<[string, string]>(
                  ([g, t], cls) => cls.startsWith('text-') ? [g, cls] : [`${g} ${cls}`.trim(), t],
                  ['', '']
                )
                return (
                  <div key={api.id} className="group flex flex-col rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
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

                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{api.name}</h3>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{api.category}</span>
                    </div>
                    <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-gray-500">{api.description}</p>

                    <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
                      <span className="font-medium">{fmtCompact(api.totalCalls)} calls</span>
                      <span>·</span>
                      <span className="truncate">{api.providerName}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/demo?api=${api.slug}`}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                      >
                        <Zap className="h-3.5 w-3.5" /> Try Now
                      </Link>
                      <Link
                        href={`/marketplace/${api.slug}`}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:border-gray-300"
                      >
                        Details <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
