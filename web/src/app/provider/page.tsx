'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowLeft,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Settings,
  Shield,
  Wallet,
} from 'lucide-react'

type ProviderTab = 'overview' | 'apis' | 'register' | 'calls' | 'settings'

interface ProviderDashboardData {
  provider: {
    name: string
    stellarAddress: string
    email: string | null
    description: string | null
    verified: boolean
    totalEarnings: number
    createdAt: string
  }
  summary: {
    totalApis: number
    activeApis: number
    totalCalls: number
    totalRevenue: number
    averageRevenuePerCall: number
    successRate: number
    avgLatencyMs: number
  }
  apis: Array<{
    id: string
    slug: string
    name: string
    icon: string
    description: string
    category: string
    endpoint: string
    method: string
    priceUsdc: number
    totalCalls: number
    revenue: number
    successRate: number
    avgLatencyMs: number
    isActive: boolean
  }>
  recentCalls: Array<{
    id: string
    apiName: string
    callerAddress: string
    txHash: string
    amountUsdc: number
    success: boolean
    latencyMs: number | null
    errorMessage: string | null
    createdAt: string
  }>
}

const TABS: ProviderTab[] = ['overview', 'apis', 'register', 'calls', 'settings']
const STORAGE_KEY = 'agentmarket-provider-address'

const formatMoney = (value: number) => `$${value.toFixed(3)}`
const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const formatRelative = (value: string) => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) >= 86400) return formatter.format(Math.round(seconds / 86400), 'day')
  if (Math.abs(seconds) >= 3600) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 60), 'minute')
}

export default function ProviderPage() {
  const [activeTab, setActiveTab] = useState<ProviderTab>('overview')
  const [addressInput, setAddressInput] = useState('')
  const [providerAddress, setProviderAddress] = useState('')
  const [dashboard, setDashboard] = useState<ProviderDashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)

  const loadDashboard = useCallback(async (stellarAddress: string) => {
    if (!stellarAddress) {
      setDashboard(null)
      setDashboardError(null)
      return
    }

    try {
      setDashboardLoading(true)
      setDashboardError(null)
      const response = await fetch(`/api/provider/dashboard?stellarAddress=${encodeURIComponent(stellarAddress)}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load provider dashboard')
      setDashboard(body)
    } catch (error) {
      setDashboard(null)
      setDashboardError(error instanceof Error ? error.message : 'Failed to load provider dashboard')
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) || ''
    setAddressInput(saved)
    setProviderAddress(saved)
    if (saved) void loadDashboard(saved)
  }, [loadDashboard])

  const topApis = useMemo(
    () => [...(dashboard?.apis || [])].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    [dashboard]
  )

  const connectProvider = async () => {
    const value = addressInput.trim()
    setProviderAddress(value)
    setRegisterError(null)
    setRegisterSuccess(null)
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
    await loadDashboard(value)
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRegistering(true)
    setRegisterError(null)
    setRegisterSuccess(null)
    const formData = new FormData(event.currentTarget)
    const stellarAddress = String(formData.get('stellarAddress') || '')
    try {
      const response = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: formData.get('providerName'),
          email: formData.get('email') || undefined,
          providerDescription: formData.get('providerDescription') || undefined,
          stellarAddress,
          apiName: formData.get('apiName'),
          description: formData.get('description'),
          longDescription: formData.get('longDescription') || undefined,
          endpoint: formData.get('endpoint'),
          category: formData.get('category'),
          priceUsdc: Number(formData.get('priceUsdc')),
          method: formData.get('method'),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Registration failed')
      setAddressInput(stellarAddress)
      setProviderAddress(stellarAddress)
      window.localStorage.setItem(STORAGE_KEY, stellarAddress)
      setRegisterSuccess(`${body.api.name} is now live in the marketplace.`)
      setActiveTab('overview')
      event.currentTarget.reset()
      await loadDashboard(stellarAddress)
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  const provider = dashboard?.provider
  const summary = dashboard?.summary

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 z-50 w-full border-b border-[#27272a] bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1f2937] text-[10px] font-semibold tracking-[0.18em] text-white">AM</span>
            <span className="text-xl font-bold">AgentMarket</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="/marketplace" className="text-gray-400 hover:text-white transition">Marketplace</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/demo" className="text-gray-400 hover:text-white transition">Live Demo</Link>
            <Link href="/provider" className="font-medium text-white">Provider Dashboard</Link>
          </nav>
          <div className="text-sm text-gray-400">{providerAddress ? 'Provider Connected' : 'Connect Provider Wallet'}</div>
        </div>
      </header>

      <div className="px-6 pb-20 pt-24">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="card p-6">
              <h1 className="mb-2 text-3xl font-bold">Provider Dashboard</h1>
              <p className="max-w-2xl text-gray-400">Register paid APIs, expose them through the market, and track real Stellar USDC earnings and paid call traffic.</p>
            </div>
            <div className="card p-6">
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-400"><Wallet className="h-4 w-4" />Provider wallet</div>
              <div className="flex gap-3">
                <input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} className="w-full rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 text-sm focus:border-[#6366f1] focus:outline-none" placeholder="Enter Stellar payout address" />
                <button onClick={connectProvider} className="btn-primary whitespace-nowrap">Load</button>
                <button onClick={() => void loadDashboard(providerAddress)} disabled={!providerAddress || dashboardLoading} className="rounded-lg bg-[#1f2937] px-4 py-3 hover:bg-[#374151] transition"><RefreshCw className={`h-4 w-4 ${dashboardLoading ? 'animate-spin' : ''}`} /></button>
              </div>
            </div>
          </div>

          {registerSuccess && <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{registerSuccess}</div>}
          {dashboardError && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{dashboardError}</div>}

          <div className="mb-8 flex flex-wrap gap-3">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-sm capitalize transition ${activeTab === tab ? 'bg-[#6366f1] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}>{tab === 'apis' ? 'APIs' : tab}</button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[{ label: 'Revenue', value: summary ? formatMoney(summary.totalRevenue) : '$0.000', hint: 'USDC earned', icon: DollarSign }, { label: 'Calls', value: summary ? formatCompact(summary.totalCalls) : '0', hint: 'Paid requests', icon: Activity }, { label: 'Live APIs', value: summary ? String(summary.activeApis) : '0', hint: 'Marketplace listings', icon: Shield }, { label: 'Success', value: summary ? `${summary.successRate.toFixed(1)}%` : '0.0%', hint: summary ? `${summary.avgLatencyMs}ms avg latency` : 'No traffic yet', icon: Settings }].map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="card p-6"><div className="mb-2 flex items-center gap-2 text-sm text-gray-400"><Icon className="h-4 w-4" />{stat.label}</div><div className="text-3xl font-bold">{stat.value}</div><div className="mt-1 text-xs text-gray-500">{stat.hint}</div></div> })}
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="card p-6">
                  <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">Top APIs</h2><button onClick={() => setActiveTab('apis')} className="text-sm text-gray-400 hover:text-white">View all</button></div>
                  {topApis.length === 0 ? <div className="rounded-lg border border-dashed border-[#374151] p-6 text-sm text-gray-400">No APIs registered yet. Use Register API to publish your first endpoint.</div> : <div className="space-y-4">{topApis.map((api) => <div key={api.id} className="rounded-xl bg-[#111827] p-4"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-[#1f2937] px-3 text-xs font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span><div><div className="font-medium">{api.name}</div><div className="text-sm text-gray-400">{api.description}</div></div></div><div className="text-right"><div className="font-medium text-green-400">{formatMoney(api.revenue)}</div><div className="text-xs text-gray-500">{formatCompact(api.totalCalls)} calls</div></div></div></div>)}</div>}
                </div>
                <div className="card p-6">
                  <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">Recent Calls</h2><button onClick={() => setActiveTab('calls')} className="text-sm text-gray-400 hover:text-white">View all</button></div>
                  {dashboard?.recentCalls.length ? <div className="space-y-3">{dashboard.recentCalls.slice(0, 6).map((call) => <div key={call.id} className="rounded-xl bg-[#111827] p-4"><div className="flex items-center justify-between gap-4"><div><div className="font-medium">{call.apiName}</div><div className="text-sm text-gray-400">{call.callerAddress.slice(0, 6)}...{call.callerAddress.slice(-4)}</div></div><div className="text-right"><div className={call.success ? 'text-green-400' : 'text-red-400'}>{formatMoney(call.amountUsdc)}</div><div className="text-xs text-gray-500">{formatRelative(call.createdAt)}</div></div></div></div>)}</div> : <div className="rounded-lg border border-dashed border-[#374151] p-6 text-sm text-gray-400">Paid requests will appear here once agents invoke your APIs.</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apis' && (
            <div className="card overflow-x-auto p-6">
              <div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Your APIs</h2><p className="mt-1 text-sm text-gray-400">Every active listing here is discoverable in the marketplace and callable through the SDK.</p></div><button onClick={() => setActiveTab('register')} className="btn-primary text-sm">Register API</button></div>
              {!dashboard?.apis.length ? <div className="rounded-lg border border-dashed border-[#374151] p-8 text-center text-sm text-gray-400">No APIs registered for this provider wallet yet.</div> : <table className="w-full min-w-[820px]"><thead><tr className="border-b border-[#27272a] text-left text-sm text-gray-400"><th className="pb-3">API</th><th className="pb-3">Method</th><th className="pb-3">Price</th><th className="pb-3">Calls</th><th className="pb-3">Revenue</th><th className="pb-3">Health</th><th className="pb-3">Endpoint</th></tr></thead><tbody>{dashboard.apis.map((api) => <tr key={api.id} className="border-b border-[#27272a]/60 align-top"><td className="py-4"><div className="flex items-start gap-3"><span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-[#1f2937] px-3 text-xs font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span><div><div className="font-medium">{api.name}</div><div className="text-sm text-gray-400">{api.category}</div></div></div></td><td className="py-4">{api.method}</td><td className="py-4 text-green-400">{formatMoney(api.priceUsdc)}</td><td className="py-4">{formatCompact(api.totalCalls)}</td><td className="py-4 font-medium">{formatMoney(api.revenue)}</td><td className="py-4"><div>{api.successRate.toFixed(1)}%</div><div className="text-xs text-gray-500">{api.avgLatencyMs}ms</div></td><td className="py-4 text-sm text-gray-400"><div className="max-w-[280px] truncate">{api.endpoint}</div><div className="mt-1 inline-flex rounded-full bg-green-500/15 px-2 py-1 text-xs text-green-300">{api.isActive ? 'Live' : 'Paused'}</div></td></tr>)}</tbody></table>}
            </div>
          )}

          {activeTab === 'register' && (
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="card p-6"><h2 className="mb-4 text-xl font-semibold">How Registration Works</h2><div className="space-y-4 text-sm text-gray-300"><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">1. Submit a JSON endpoint</div><p className="mt-1 text-gray-400">Start with GET or POST and a stable HTTPS endpoint.</p></div><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">2. Set your payout wallet</div><p className="mt-1 text-gray-400">The market inserts your Stellar address into the 402 invoice.</p></div><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">3. Test with the SDK</div><p className="mt-1 text-gray-400">Agents can call the resulting slug through <code className="text-white">agstell-sdk</code>.</p></div></div></div>
              <div className="card p-6"><h2 className="mb-2 text-xl font-semibold">Register New API</h2><p className="mb-6 text-sm text-gray-400">This creates a provider profile if one does not exist and publishes the API into the live marketplace.</p><form onSubmit={handleRegister} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><input name="providerName" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="Provider name" required /><input name="email" type="email" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="Contact email" /></div><textarea name="providerDescription" className="h-20 w-full rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="Provider description" /><div className="grid gap-4 md:grid-cols-2"><input name="apiName" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="API name" required /><select name="method" defaultValue="GET" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none"><option value="GET">GET</option><option value="POST">POST</option></select></div><textarea name="description" className="h-20 w-full rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="Short description" required /><textarea name="longDescription" className="h-24 w-full rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="Long description" /><div className="grid gap-4 md:grid-cols-[1fr_0.34fr_0.42fr]"><input name="endpoint" type="url" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="https://api.example.com/v1/data" required /><select name="category" defaultValue="Data" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none"><option>Data</option><option>AI</option><option>Finance</option><option>Geo</option><option>Utilities</option><option>News</option><option>Weather</option></select><input name="priceUsdc" type="number" min="0.001" step="0.001" className="rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 focus:border-[#6366f1] focus:outline-none" placeholder="0.001" required /></div><input name="stellarAddress" defaultValue={providerAddress || addressInput} className="w-full rounded-lg border border-[#374151] bg-[#1f2937] px-4 py-3 text-sm focus:border-[#6366f1] focus:outline-none" placeholder="Stellar payout address" required />{registerError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{registerError}</div>}<div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="submit" className="btn-primary sm:min-w-52" disabled={registering}>{registering ? 'Registering...' : 'Publish API'}</button><div className="text-sm text-gray-400">The published API becomes available at <code className="text-white">/api/proxy/your-slug</code> and can be discovered through the marketplace.</div></div></form></div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="card p-6">
              <div className="mb-6"><h2 className="text-xl font-semibold">Paid Call History</h2><p className="mt-1 text-sm text-gray-400">Every verified x402 payment and upstream result recorded for this provider wallet.</p></div>
              {!dashboard?.recentCalls.length ? <div className="rounded-lg border border-dashed border-[#374151] p-8 text-center text-sm text-gray-400">No paid traffic yet. Register an API and run a live SDK call to populate this feed.</div> : <div className="space-y-3">{dashboard.recentCalls.map((call) => <div key={call.id} className="rounded-xl bg-[#111827] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-medium">{call.apiName}</div><div className="mt-1 text-sm text-gray-400">Caller {call.callerAddress.slice(0, 6)}...{call.callerAddress.slice(-4)}</div><div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500"><span>{formatRelative(call.createdAt)}</span><span>{call.latencyMs ? `${call.latencyMs}ms` : 'No latency'}</span><span className={call.success ? 'text-green-300' : 'text-red-300'}>{call.success ? 'Success' : call.errorMessage || 'Failed'}</span></div></div><div className="flex items-center gap-4"><div className="text-right"><div className="font-medium text-green-400">{formatMoney(call.amountUsdc)}</div><div className="text-xs text-gray-500">tx {call.txHash.slice(0, 10)}...</div></div><a href={`https://testnet.stellarchain.io/tx/${call.txHash}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#1f2937] p-3 text-gray-300 hover:bg-[#374151]"><ExternalLink className="h-4 w-4" /></a></div></div></div>)}</div>}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="card p-6"><h2 className="mb-4 text-xl font-semibold">Provider Profile</h2>{provider ? <div className="space-y-4 text-sm"><div><div className="text-gray-400">Name</div><div className="mt-1 text-white">{provider.name}</div></div><div><div className="text-gray-400">Email</div><div className="mt-1 text-white">{provider.email || 'Not set'}</div></div><div><div className="text-gray-400">Wallet</div><div className="mt-1 break-all text-white">{provider.stellarAddress}</div></div><div><div className="text-gray-400">Joined</div><div className="mt-1 text-white">{new Date(provider.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div><div className="rounded-lg bg-[#111827] px-4 py-3 text-sm text-gray-300">{provider.verified ? 'Verified provider profile' : 'Provider is live and submission-ready.'}</div></div> : <div className="text-sm text-gray-400">Load a provider wallet to view saved profile settings.</div>}</div>
              <div className="card p-6"><h2 className="mb-4 text-xl font-semibold">How To Use This Dashboard</h2><div className="space-y-4 text-sm text-gray-300"><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">Overview</div><p className="mt-1 text-gray-400">Check revenue, traffic, live APIs, and reliability at a glance.</p></div><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">APIs</div><p className="mt-1 text-gray-400">Review every listing, price point, and endpoint configuration.</p></div><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">Register API</div><p className="mt-1 text-gray-400">Publish a new endpoint into the marketplace and make it callable through the SDK.</p></div><div className="rounded-lg bg-[#111827] p-4"><div className="font-medium">Calls</div><p className="mt-1 text-gray-400">Audit tx hashes, traffic, and provider-side reliability for each paid request.</p></div></div></div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
