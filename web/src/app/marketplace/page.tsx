'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, ArrowLeft, Zap } from 'lucide-react';

interface MarketplaceApi {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  priceUsdc: number;
  totalCalls: number;
  providerName: string;
}

interface MarketplaceStats {
  totalApis: number;
  totalProviders: number;
  totalCalls: number;
  averagePriceUsdc: number;
}

const CATEGORIES = ['All', 'Data', 'Finance', 'AI', 'Geo', 'Utilities'];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [apis, setApis] = useState<MarketplaceApi[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMarketplace = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/marketplace');
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load marketplace');
        }

        setApis(body.apis ?? []);
        setStats(body.stats ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marketplace');
      } finally {
        setLoading(false);
      }
    };

    loadMarketplace();
  }, []);

  const filteredApis = useMemo(() => {
    return apis.filter((api) => {
      const matchesSearch =
        api.name.toLowerCase().includes(search.toLowerCase()) ||
        api.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'All' || api.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [apis, category, search]);

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1f2937] text-[10px] font-semibold tracking-[0.18em] text-white">AM</span>
            <span className="font-bold text-xl">AgentMarket</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-white font-medium">Marketplace</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/demo" className="text-gray-400 hover:text-white transition">Live Demo</Link>
            <Link href="/provider" className="text-gray-400 hover:text-white transition">Provider Dashboard</Link>
          </nav>
          <Link href="/demo" className="btn-primary text-sm">
            Try Demo
          </Link>
        </div>
      </header>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-3">API Marketplace</h1>
            <p className="text-gray-400">Pay-per-call APIs for AI agents. No subscriptions, no API keys.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search APIs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#1f2937] border border-[#27272a] rounded-lg focus:outline-none focus:border-[#6366f1]"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <Filter className="w-5 h-5 text-gray-400 hidden md:block" />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                    category === cat
                      ? 'bg-[#6366f1] text-white'
                      : 'bg-[#1f2937] text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total APIs', value: stats ? stats.totalApis.toString() : '...' },
              { label: 'Total Calls', value: stats ? formatCompactNumber(stats.totalCalls) : '...' },
              { label: 'Avg Price', value: stats ? `$${stats.averagePriceUsdc.toFixed(3)}` : '...' },
              { label: 'Providers', value: stats ? stats.totalProviders.toString() : '...' },
            ].map((stat) => (
              <div key={stat.label} className="card p-4 text-center">
                <div className="text-2xl font-bold text-[#6366f1]">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading marketplace...</div>
          ) : error ? (
            <div className="text-center py-20 text-red-400">{error}</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApis.map((api) => (
                <div key={api.id} className="card p-6 hover:border-[#6366f1] transition group">
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-[#1f2937] px-3 text-xs font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span>
                    <span className="text-green-400 font-mono font-semibold">${api.priceUsdc.toFixed(3)}</span>
                  </div>

                  <h3 className="text-xl font-semibold mb-2">{api.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{api.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span>{formatCompactNumber(api.totalCalls)} calls</span>
                    <span>•</span>
                    <span>{api.providerName}</span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/demo?api=${api.slug}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-[#6366f1] rounded-lg text-sm font-medium hover:bg-[#818cf8] transition"
                    >
                      <Zap className="w-4 h-4" />
                      Try Now
                    </Link>
                    <Link
                      href={`/marketplace/${api.slug}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-[#1f2937] rounded-lg text-sm font-medium hover:bg-[#374151] transition"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && filteredApis.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400">No APIs found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
