'use client'

import Link from 'next/link'
import { Nav } from '@/components/Nav'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt$ = (v: number) => `$${v.toFixed(4)}`
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

function fmtRelative(iso: string) {
  const sec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(sec) >= 86400) return rtf.format(Math.round(sec / 86400), 'day')
  if (Math.abs(sec) >= 3600) return rtf.format(Math.round(sec / 3600), 'hour')
  return rtf.format(Math.round(sec / 60), 'minute')
}

function truncateAddress(addr: string) {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    </span>
  )
}

function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'green' | 'red' | 'indigo' | 'neutral' | 'amber' }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
    red: 'bg-red-50 text-red-600 ring-red-200/60',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/60',
    neutral: 'bg-gray-100 text-gray-500 ring-gray-200/60',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200/60',
  }[variant]
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset ${styles}`}>
      {children}
    </span>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-gray-400 font-normal normal-case tracking-normal">{hint}</p>}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...props}
    />
  )
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${className}`}
      {...props}
    />
  )
}

function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...props}
    />
  )
}

function EmptyState({ icon: Icon = Zap, title, body }: { icon?: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-400 max-w-xs">{body}</p>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, trend, accent,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  trend?: string
  accent?: 'indigo' | 'emerald' | 'violet' | 'amber'
}) {
  const iconBg = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    violet: 'bg-violet-600',
    amber: 'bg-amber-500',
  }[accent ?? 'indigo'] ?? 'bg-gray-200'

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
            <TrendingUp className="h-3 w-3" /> {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ dashboard, onTabChange }: { dashboard: ProviderDashboardData | null; onTabChange: (t: ProviderTab) => void }) {
  const s = dashboard?.summary
  const topApis = useMemo(() => [...(dashboard?.apis ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [dashboard])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={s ? fmt$(s.totalRevenue) : '$0.0000'} sub="USDC earned to date" icon={DollarSign} accent="emerald" />
        <StatCard label="API Calls" value={s ? fmtCompact(s.totalCalls) : '0'} sub="Paid requests processed" icon={Activity} accent="indigo" />
        <StatCard label="Live APIs" value={s ? String(s.activeApis) : '0'} sub={s ? `${s.totalApis} total registered` : 'No APIs yet'} icon={Shield} accent="violet" />
        <StatCard label="Success Rate" value={s ? fmtPct(s.successRate) : '—'} sub={s?.totalCalls ? `${s.avgLatencyMs}ms avg latency` : 'No traffic yet'} icon={BarChart3} accent="amber" />
      </div>

      {/* Content grid */}
      <div className="grid gap-5 xl:grid-cols-5">
        {/* Top APIs */}
        <div className="xl:col-span-3 rounded-xl border border-gray-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Top APIs by Revenue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your highest earning endpoints</p>
            </div>
            <button onClick={() => onTabChange('apis')} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {topApis.length === 0 ? (
            <EmptyState icon={Zap} title="No APIs yet" body="Register your first endpoint to start earning." />
          ) : (
            <div className="divide-y divide-gray-50">
              {topApis.map((api, i) => (
                <div key={api.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <span className="w-5 text-center text-xs font-bold text-gray-300">#{i + 1}</span>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-600">
                    {api.icon || api.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{api.name}</p>
                    <p className="text-xs text-gray-400">{api.category} · {api.method}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">{fmtCompact(api.totalCalls)} calls</p>
                      <p className="text-xs text-gray-400">{fmtPct(api.successRate)} uptime</p>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-sm font-bold text-emerald-600">{fmt$(api.revenue)}</p>
                      <StatusDot active={api.isActive} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent calls */}
        <div className="xl:col-span-2 rounded-xl border border-gray-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent Calls</h2>
              <p className="text-xs text-gray-400 mt-0.5">Live payment activity</p>
            </div>
            <button onClick={() => onTabChange('calls')} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              All <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {!dashboard?.recentCalls.length ? (
            <EmptyState icon={Activity} title="No calls yet" body="Paid API requests will appear here in real time." />
          ) : (
            <div className="divide-y divide-gray-50">
              {dashboard.recentCalls.slice(0, 7).map((call) => (
                <div key={call.id} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${call.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{call.apiName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{truncateAddress(call.callerAddress)}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-bold text-emerald-600">{fmt$(call.amountUsdc)}</p>
                    <p className="text-[11px] text-gray-400">{fmtRelative(call.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── APIs Tab ─────────────────────────────────────────────────────────────────

function ApisTab({ dashboard, onRegister }: { dashboard: ProviderDashboardData | null; onRegister: () => void }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Registered APIs</h2>
          <p className="text-xs text-gray-400 mt-0.5">All endpoints available in the marketplace</p>
        </div>
        <button
          onClick={onRegister}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" /> New API
        </button>
      </div>

      {!dashboard?.apis.length ? (
        <EmptyState icon={Zap} title="No APIs registered" body="Publish your first endpoint to appear in the marketplace." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['API', 'Method', 'Price / call', 'Calls', 'Revenue', 'Uptime', 'Latency', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboard.apis.map((api) => (
                <tr key={api.id} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                        {api.icon || api.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{api.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{api.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={api.method === 'POST' ? 'indigo' : 'neutral'}>{api.method}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-gray-900">{fmt$(api.priceUsdc)}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{fmtCompact(api.totalCalls)}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold text-emerald-600">{fmt$(api.revenue)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[64px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${api.successRate}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{fmtPct(api.successRate)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />{api.avgLatencyMs}ms
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <StatusDot active={api.isActive} />
                      <span className="text-xs text-gray-600">{api.isActive ? 'Live' : 'Paused'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Register Tab ─────────────────────────────────────────────────────────────

function RegisterTab({ providerAddress, registering, registerError, registerSuccess, onSubmit }: {
  providerAddress: string
  registering: boolean
  registerError: string | null
  registerSuccess: string | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
      {/* Left guide panel */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">How it works</p>
          <ol className="space-y-5">
            {[
              { n: '01', title: 'Submit your endpoint', body: 'Any GET or POST endpoint returning JSON over HTTPS.' },
              { n: '02', title: 'Set payout wallet', body: 'Your Stellar address is embedded in every 402 invoice. Payments land directly in your wallet.' },
              { n: '03', title: 'Agents call by slug', body: 'Callable via agstell-sdk instantly, with no SDK update needed.' },
            ].map((s) => (
              <li key={s.n} className="flex gap-3.5">
                <span className="text-[11px] font-mono font-bold text-indigo-400 mt-0.5 w-5 flex-shrink-0">{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-xs text-indigo-700 leading-relaxed">
            After publishing, your API is live at{' '}
            <code className="rounded bg-indigo-100 px-1 py-0.5 font-mono text-indigo-800">/api/proxy/your-slug</code>{' '}
            and discoverable in the marketplace.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <div className="mb-6 pb-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Register New API</h2>
          <p className="mt-1 text-xs text-gray-400">Creates a provider profile if needed, then publishes the API into the marketplace.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Provider */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-500">Provider</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><FieldLabel>Provider name *</FieldLabel><Input name="providerName" placeholder="Acme Data Co." required /></div>
              <div><FieldLabel>Contact email</FieldLabel><Input name="email" type="email" placeholder="you@example.com" /></div>
            </div>
            <div className="mt-4">
              <FieldLabel hint="Shown on your provider profile in the marketplace">Provider description</FieldLabel>
              <Textarea name="providerDescription" rows={2} placeholder="What does your provider offer?" />
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* API Details */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-500">API Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><FieldLabel>API name *</FieldLabel><Input name="apiName" placeholder="Real-time Weather" required /></div>
              <div><FieldLabel>HTTP Method</FieldLabel>
                <Select name="method" defaultValue="GET">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </Select>
              </div>
            </div>
            <div className="mt-4"><FieldLabel>Short description *</FieldLabel><Textarea name="description" rows={2} placeholder="One or two sentences describing the API." required /></div>
            <div className="mt-4"><FieldLabel hint="Used on the marketplace detail page">Long description</FieldLabel><Textarea name="longDescription" rows={3} placeholder="Full description with use cases, data sources, and response format." /></div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Endpoint & Pricing */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-indigo-500">Endpoint &amp; Pricing</p>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px_130px]">
              <div><FieldLabel>Endpoint URL *</FieldLabel><Input name="endpoint" type="url" placeholder="https://api.example.com/v1/data" required /></div>
              <div><FieldLabel>Category</FieldLabel>
                <Select name="category" defaultValue="Data">
                  {['Data', 'AI', 'Finance', 'Geo', 'Utilities', 'News', 'Weather', 'Agent'].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div><FieldLabel hint="USDC per call">Price *</FieldLabel><Input name="priceUsdc" type="number" min="0.001" step="0.001" placeholder="0.001" required /></div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Payout Wallet */}
          <div>
            <FieldLabel hint="Payments land here on Stellar. Must be a valid G… public key.">Stellar payout address *</FieldLabel>
            <Input name="stellarAddress" defaultValue={providerAddress || ''} placeholder="GXXX…" className="font-mono text-xs" required />
          </div>

          <div className="border-t border-gray-100" />

          {/* Capability Spec */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-500">Capability Spec</p>
            <p className="mb-4 text-xs text-gray-400">Machine-readable contract that helps agents understand your API before spending money.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><FieldLabel>Side effects</FieldLabel>
                <Select name="sideEffectLevel" defaultValue="read">
                  <option value="read">Read — no side effects</option>
                  <option value="write">Write — modifies state</option>
                  <option value="financial">Financial — moves money</option>
                  <option value="destructive">Destructive — irreversible</option>
                </Select>
              </div>
              <div><FieldLabel>Latency</FieldLabel>
                <Select name="latencyHint" defaultValue="fast">
                  <option value="fast">Fast — &lt; 500ms</option>
                  <option value="medium">Medium — 500ms–2s</option>
                  <option value="slow">Slow — &gt; 2s</option>
                </Select>
              </div>
              <div><FieldLabel>Idempotent</FieldLabel>
                <Select name="idempotent" defaultValue="true">
                  <option value="true">Yes — safe to retry</option>
                  <option value="false">No — each call is unique</option>
                </Select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel hint="JSON object agents use to construct requests">Example request</FieldLabel>
                <Textarea name="exampleRequest" rows={4} placeholder={'{\n  "city": "Mumbai"\n}'} className="font-mono text-xs" />
              </div>
              <div>
                <FieldLabel hint="JSON object showing what the API returns">Example response</FieldLabel>
                <Textarea name="exampleResponse" rows={4} placeholder={'{\n  "temp": 32,\n  "conditions": "Cloudy"\n}'} className="font-mono text-xs" />
              </div>
            </div>
          </div>

          {registerError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{registerError}</p>
            </div>
          )}
          {registerSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <p className="text-sm text-emerald-700">{registerSuccess}</p>
            </div>
          )}

          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={registering}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {registering ? <><RefreshCw className="h-4 w-4 animate-spin" /> Publishing…</> : <><ArrowUpRight className="h-4 w-4" /> Publish API</>}
            </button>
            <p className="text-xs text-gray-400">Goes live in the marketplace immediately after passing readiness checks.</p>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Calls Tab ────────────────────────────────────────────────────────────────

function CallsTab({ dashboard }: { dashboard: ProviderDashboardData | null }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Paid Call History</h2>
        <p className="text-xs text-gray-400 mt-0.5">Every verified x402 payment recorded for this provider wallet</p>
      </div>

      {!dashboard?.recentCalls.length ? (
        <EmptyState icon={Activity} title="No paid traffic yet" body="Register an API and run a live SDK call to populate this feed." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['API', 'Caller', 'Amount', 'Latency', 'Time', 'Status', 'TX Hash'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboard.recentCalls.map((call) => (
                <tr key={call.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{call.apiName}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{truncateAddress(call.callerAddress)}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-bold text-emerald-600">{fmt$(call.amountUsdc)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />{call.latencyMs ? `${call.latencyMs}ms` : '—'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{fmtRelative(call.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    {call.success
                      ? <Badge variant="green">Success</Badge>
                      : <Badge variant="red">Failed</Badge>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <a
                      href={`https://testnet.stellarchain.io/tx/${call.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-mono text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      {call.txHash.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ dashboard }: { dashboard: ProviderDashboardData | null }) {
  const provider = dashboard?.provider
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Provider Profile</p>
        {provider ? (
          <dl className="space-y-4">
            {[
              { label: 'Name', value: provider.name },
              { label: 'Email', value: provider.email ?? 'Not set' },
              { label: 'Wallet', value: provider.stellarAddress, mono: true },
              { label: 'Member since', value: new Date(provider.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
              { label: 'Total earnings', value: `${fmt$(provider.totalEarnings)} USDC` },
            ].map(({ label, value, mono }) => (
              <div key={label} className="rounded-lg bg-gray-50 px-4 py-3">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
                <dd className={`mt-1 text-sm text-gray-800 break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</dd>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              <p className="text-xs font-medium text-emerald-700">{provider.verified ? 'Verified provider' : 'Active and submission-ready'}</p>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">Load a provider wallet to view your profile.</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Dashboard Guide</p>
        <div className="space-y-3">
          {[
            { title: 'Overview', body: 'Revenue, traffic, live APIs, and success rate at a glance.' },
            { title: 'APIs', body: 'Every listing with price, call count, revenue, and health metrics.' },
            { title: 'Register API', body: 'Publish a new endpoint into the marketplace — callable immediately via agstell-sdk.' },
            { title: 'Calls', body: 'Full audit trail: tx hash, caller, latency, and status for every paid request.' },
          ].map(({ title, body }) => (
            <div key={title} className="flex gap-3 rounded-lg border border-gray-100 p-4 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
              <ArrowUpRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{title}</p>
                <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: ProviderTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'apis', label: 'APIs', icon: List },
  { id: 'register', label: 'Register API', icon: Plus },
  { id: 'calls', label: 'Calls', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const STORAGE_KEY = 'agentmarket-provider-address'

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
  const [freighterLoading, setFreighterLoading] = useState(false)
  const [freighterError, setFreighterError] = useState<string | null>(null)

  const loadDashboard = useCallback(async (addr: string) => {
    if (!addr) { setDashboard(null); setDashboardError(null); return }
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const res = await fetch(`/api/provider/dashboard?stellarAddress=${encodeURIComponent(addr)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to load dashboard')
      setDashboard(body)
    } catch (e) {
      setDashboard(null)
      setDashboardError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? ''
    setAddressInput(saved)
    setProviderAddress(saved)
    if (saved) void loadDashboard(saved)
  }, [loadDashboard])

  const connectProvider = () => {
    const value = addressInput.trim()
    setProviderAddress(value)
    setRegisterError(null)
    setRegisterSuccess(null)
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
    void loadDashboard(value)
  }

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setRegistering(true)
    setRegisterError(null)
    setRegisterSuccess(null)
    const fd = new FormData(e.currentTarget)
    const stellarAddress = String(fd.get('stellarAddress') ?? '')
    try {
      const rawExReq = String(fd.get('exampleRequest') ?? '').trim()
      const rawExRes = String(fd.get('exampleResponse') ?? '').trim()
      let exampleRequest: Record<string, unknown> | undefined
      let exampleResponse: Record<string, unknown> | undefined
      try { if (rawExReq) exampleRequest = JSON.parse(rawExReq) } catch { /* ignore */ }
      try { if (rawExRes) exampleResponse = JSON.parse(rawExRes) } catch { /* ignore */ }

      const res = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: fd.get('providerName'),
          email: fd.get('email') || undefined,
          providerDescription: fd.get('providerDescription') || undefined,
          stellarAddress,
          apiName: fd.get('apiName'),
          description: fd.get('description'),
          longDescription: fd.get('longDescription') || undefined,
          endpoint: fd.get('endpoint'),
          category: fd.get('category'),
          priceUsdc: Number(fd.get('priceUsdc')),
          method: fd.get('method'),
          sideEffectLevel: fd.get('sideEffectLevel') || 'read',
          latencyHint: fd.get('latencyHint') || 'fast',
          idempotent: fd.get('idempotent') === 'true',
          exampleRequest,
          exampleResponse,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Registration failed')
      setAddressInput(stellarAddress)
      setProviderAddress(stellarAddress)
      window.localStorage.setItem(STORAGE_KEY, stellarAddress)
      setRegisterSuccess(`${body.api.name} is now live in the marketplace.`)
      setActiveTab('overview')
      e.currentTarget.reset()
      await loadDashboard(stellarAddress)
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  const connectFreighter = async () => {
    setFreighterError(null)
    setFreighterLoading(true)
    try {
      const { isConnected: freighterInstalled, requestAccess, getAddress } = await import('@stellar/freighter-api')
      const { isConnected: installed } = await freighterInstalled()
      if (!installed) { setFreighterError('Freighter not installed. Get it at freighter.app'); return }
      await requestAccess()
      const { address, error } = await getAddress()
      if (error || !address) { setFreighterError('Could not get address. Please approve the request.'); return }
      setAddressInput(address)
      setProviderAddress(address)
      window.localStorage.setItem(STORAGE_KEY, address)
      void loadDashboard(address)
    } catch {
      setFreighterError('Failed to connect Freighter. Make sure it is installed and unlocked.')
    } finally {
      setFreighterLoading(false)
    }
  }

  const isConnected = Boolean(providerAddress)

  return (
    <main className="min-h-screen bg-gray-50/70">
      <Nav />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-24 pt-20">

        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
              <span>/</span>
              <span className="text-gray-600 font-medium">Provider Dashboard</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Provider Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Publish APIs, track earnings, monitor usage.</p>
          </div>

          {/* Wallet connect card */}
          <div className="lg:w-[380px] rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <Wallet className="h-3.5 w-3.5" /> Provider wallet
              </div>
              {isConnected && (
                <div className="flex items-center gap-1.5">
                  <StatusDot active />
                  <span className="text-[11px] text-emerald-600 font-medium">Connected</span>
                </div>
              )}
            </div>

            <button
              onClick={connectFreighter}
              disabled={freighterLoading}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-gradient-to-b from-indigo-50 to-indigo-100/60 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition hover:from-indigo-100 hover:to-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {freighterLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (
                <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#6366f1"/>
                  <path d="M8 16a8 8 0 1 1 16 0A8 8 0 0 1 8 16zm8-5a5 5 0 1 0 0 10A5 5 0 0 0 16 11zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="white"/>
                </svg>
              )}
              {freighterLoading ? 'Connecting…' : 'Connect Freighter Wallet'}
            </button>

            {freighterError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{freighterError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[11px] text-gray-400">or paste address</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="flex gap-2">
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connectProvider()}
                placeholder="G… Stellar public key"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <button onClick={connectProvider} className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-700">
                Load
              </button>
              <button
                onClick={() => void loadDashboard(providerAddress)}
                disabled={!providerAddress || dashboardLoading}
                title="Refresh"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-400 transition hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {isConnected && (
              <p className="mt-2 truncate font-mono text-[10px] text-gray-400 bg-gray-50 rounded px-2 py-1">
                {providerAddress}
              </p>
            )}
          </div>
        </div>

        {/* ── Global alerts ─────────────────────────────────────────────────── */}
        {registerSuccess && (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            <p className="text-sm text-emerald-800">{registerSuccess}</p>
          </div>
        )}
        {dashboardError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-800">{dashboardError}</p>
          </div>
        )}

        {/* ── Layout: sidebar + content ──────────────────────────────────────── */}
        <div className="flex gap-6">

          {/* Sidebar nav */}
          <nav className="hidden lg:flex w-48 flex-shrink-0 flex-col gap-1 self-start sticky top-24 rounded-xl border border-gray-200/80 bg-white p-2 shadow-sm">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Mobile tab bar */}
          <div className="lg:hidden w-full -mx-0 mb-4">
            <div className="flex overflow-x-auto gap-1 rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-sm no-scrollbar">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      active ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'overview' && <OverviewTab dashboard={dashboard} onTabChange={setActiveTab} />}
            {activeTab === 'apis' && <ApisTab dashboard={dashboard} onRegister={() => setActiveTab('register')} />}
            {activeTab === 'register' && (
              <RegisterTab
                providerAddress={providerAddress}
                registering={registering}
                registerError={registerError}
                registerSuccess={registerSuccess}
                onSubmit={handleRegister}
              />
            )}
            {activeTab === 'calls' && <CallsTab dashboard={dashboard} />}
            {activeTab === 'settings' && <SettingsTab dashboard={dashboard} />}
          </div>
        </div>
      </div>
    </main>
  )
}
