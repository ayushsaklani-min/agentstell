'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/Nav'
import { AlertCircle, ArrowLeft, Filter, Loader2, Search, Zap } from 'lucide-react'

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

const CATEGORIES = ['All', 'Data', 'Finance', 'AI', 'Geo', 'Utilities', 'News', 'Weather']

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return apis.filter((api) => {
      const matchSearch =
        api.name.toLowerCase().includes(q) || api.description.toLowerCase().includes(q)
      const matchCat = category === 'All' || api.category === category
      return matchSearch && matchCat
    })
  }, [apis, search, category])

  return (
    <main className="min-h-screen bg-white">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-24">
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        {/* Page header */}
        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Marketplace</h1>
          <p className="mt-2 text-gray-500">
            Pay-per-call APIs for AI agents. No subscriptions, no API keys.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total APIs', value: stats ? String(stats.totalApis) : '—' },
            { label: 'Total Calls', value: stats ? fmtCompact(stats.totalCalls) : '—' },
            { label: 'Avg Price', value: stats ? `$${stats.averagePriceUsdc.toFixed(3)}` : '—' },
            { label: 'Providers', value: stats ? String(stats.totalProviders) : '—' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4 text-center">
              <p className="text-xl font-bold text-indigo-600">{stat.value}</p>
              <p className="mt-0.5 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search APIs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter className="h-4 w-4 flex-shrink-0 text-gray-400" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  category === cat
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-3 text-gray-500">Loading marketplace…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-3 py-20 text-red-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-500">No APIs found matching your search.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((api) => (
              <div key={api.id} className="card flex flex-col p-5 transition hover:border-indigo-300 hover:shadow-md">
                <div className="mb-4 flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold tracking-widest text-gray-600">
                    {api.icon}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700">
                    ${api.priceUsdc.toFixed(3)}
                  </span>
                </div>

                <h3 className="mb-1 font-semibold text-gray-900">{api.name}</h3>
                <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-500">{api.description}</p>

                <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
                  <span>{fmtCompact(api.totalCalls)} calls</span>
                  <span>·</span>
                  <span>{api.providerName}</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/demo?api=${api.slug}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 px-3 text-sm font-medium text-white transition hover:bg-indigo-500"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Try Now
                  </Link>
                  <Link
                    href={`/marketplace/${api.slug}`}
                    className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 py-2 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
