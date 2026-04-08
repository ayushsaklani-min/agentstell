'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Zap, Code, Copy, Check, ExternalLink, Clock, Shield, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MarketplaceParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface MarketplaceApiDetail {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  longDescription: string;
  providerName: string;
  priceUsdc: number;
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  params: MarketplaceParam[];
  exampleRequest: Record<string, unknown>;
  exampleResponse: Record<string, unknown>;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ApiDetailPage() {
  const params = useParams();
  const apiId = params.id as string;
  const [api, setApi] = useState<MarketplaceApiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadApi = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/marketplace/${apiId}`);
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load API details');
        }

        setApi(body.api);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load API details');
      } finally {
        setLoading(false);
      }
    };

    loadApi();
  }, [apiId]);

  if (loading) {
    return (
      <main className="min-h-screen pt-24 px-6">
        <div className="max-w-4xl mx-auto text-center text-gray-400">Loading API details...</div>
      </main>
    );
  }

  if (error || !api) {
    return (
      <main className="min-h-screen pt-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">API Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'The requested API does not exist.'}</p>
          <Link href="/marketplace" className="text-[#6366f1] hover:underline">
            ← Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  const codeExample = `import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({
  secretKey: process.env.STELLAR_SECRET,
  network: 'testnet'
})

const result = await agent.get('${api.slug}', ${JSON.stringify(api.exampleRequest, null, 2)})

console.log(result.data)
// Cost: $${api.priceUsdc.toFixed(3)} USDC`;

  const copyCode = () => {
    navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <Link href="/demo" className="btn-primary text-sm">Try Demo</Link>
        </div>
      </header>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
            <div className="flex items-start gap-4">
              <span className="inline-flex min-h-16 min-w-16 items-center justify-center rounded-xl bg-[#1f2937] px-4 text-sm font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{api.name}</h1>
                  <span className="px-3 py-1 bg-[#1f2937] rounded-full text-sm">{api.category}</span>
                </div>
                <p className="text-gray-400 max-w-xl">{api.longDescription}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-3xl font-bold text-green-400">${api.priceUsdc.toFixed(3)}</div>
              <div className="text-sm text-gray-500">per call</div>
              <Link href={`/demo?api=${api.slug}`} className="btn-primary flex items-center gap-2 mt-2">
                <Zap className="w-4 h-4" />
                Try Now
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Total Calls
              </div>
              <div className="text-2xl font-bold">{formatCompactNumber(api.totalCalls)}</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Shield className="w-4 h-4" />
                Success Rate
              </div>
              <div className="text-2xl font-bold text-green-400">{api.successRate.toFixed(1)}%</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Avg Latency
              </div>
              <div className="text-2xl font-bold">{api.avgLatencyMs}ms</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <ExternalLink className="w-4 h-4" />
                Provider
              </div>
              <div className="text-2xl font-bold">{api.providerName}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Parameters</h2>
              <div className="space-y-4">
                {api.params.map((param) => (
                  <div key={param.name} className="bg-[#1f2937] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-[#6366f1] font-mono">{param.name}</code>
                      <span className="text-xs text-gray-500">{param.type}</span>
                      {param.required && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">required</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{param.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Example Response</h2>
              <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-gray-300">
                  {JSON.stringify(api.exampleResponse, null, 2)}
                </code>
              </pre>
            </div>
          </div>

          <div className="card p-6 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-semibold">Code Example</h2>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1f2937] rounded-lg text-sm hover:bg-[#374151] transition"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-gray-300">{codeExample}</code>
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}
