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
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Shield,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
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

// ─── Formatting helpers ────────────────────────────────────────────────────────

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
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ─── Small shared primitives ───────────────────────────────────────────────────

function Badge({
  children,
  variant = 'neutral',
}: {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'indigo' | 'neutral'
}) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    neutral: 'bg-gray-100 text-gray-600 ring-gray-200',
  }[variant]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`rounded-lg p-2 ${accent ? 'bg-indigo-50' : 'bg-gray-100'}`}>
          <Icon className={`h-4 w-4 ${accent ? 'text-indigo-600' : 'text-gray-500'}`} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
      <div className="rounded-full bg-gray-100 p-3">
        <Zap className="h-5 w-5 text-gray-400" />
      </div>
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-medium text-gray-700">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${className}`}
      {...props}
    />
  )
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${className}`}
      {...props}
    />
  )
}

function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${className}`}
      {...props}
    />
  )
}

// ─── Tab sections ──────────────────────────────────────────────────────────────

function OverviewTab({
  dashboard,
  onTabChange,
}: {
  dashboard: ProviderDashboardData | null
  onTabChange: (tab: ProviderTab) => void
}) {
  const s = dashboard?.summary
  const topApis = useMemo(
    () => [...(dashboard?.apis ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 4),
    [dashboard]
  )

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={s ? fmt$(s.totalRevenue) : '$0.0000'}
          sub="USDC earned"
          icon={DollarSign}
          accent
        />
        <StatCard
          label="Total calls"
          value={s ? fmtCompact(s.totalCalls) : '0'}
          sub="Paid API requests"
          icon={Activity}
        />
        <StatCard
          label="Live APIs"
          value={s ? String(s.activeApis) : '0'}
          sub={s ? `of ${s.totalApis} registered` : 'No APIs yet'}
          icon={Shield}
        />
        <StatCard
          label="Success rate"
          value={s ? fmtPct(s.successRate) : '—'}
          sub={s && s.totalCalls > 0 ? `${s.avgLatencyMs}ms avg latency` : 'No traffic yet'}
          icon={TrendingUp}
        />
      </div>

      {/* Two-column: top APIs + recent calls */}
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Top APIs */}
        <div className="xl:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Top APIs</h2>
              <button
                onClick={() => onTabChange('apis')}
                className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100 px-5">
              {topApis.length === 0 ? (
                <div className="py-8">
                  <EmptyState message="No APIs registered yet. Use Register API to publish your first endpoint." />
                </div>
              ) : (
                topApis.map((api) => (
                  <div key={api.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-semibold tracking-widest text-gray-600">
                        {api.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{api.name}</p>
                        <p className="truncate text-xs text-gray-500">{api.category} · {api.method}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-emerald-600">{fmt$(api.revenue)}</p>
                      <p className="text-xs text-gray-500">{fmtCompact(api.totalCalls)} calls</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent calls */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Calls</h2>
              <button
                onClick={() => onTabChange('calls')}
                className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100 px-5">
              {!dashboard?.recentCalls.length ? (
                <div className="py-8">
                  <EmptyState message="Paid requests appear here once agents call your APIs." />
                </div>
              ) : (
                dashboard.recentCalls.slice(0, 6).map((call) => (
                  <div key={call.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{call.apiName}</p>
                      <p className="text-xs text-gray-500">{truncateAddress(call.callerAddress)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-semibold ${call.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt$(call.amountUsdc)}
                      </p>
                      <p className="text-xs text-gray-500">{fmtRelative(call.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApisTab({
  dashboard,
  onRegister,
}: {
  dashboard: ProviderDashboardData | null
  onRegister: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Registered APIs</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Every active listing here is discoverable in the marketplace and callable via the SDK.
          </p>
        </div>
        <button
          onClick={onRegister}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          + Register API
        </button>
      </div>

      {!dashboard?.apis.length ? (
        <div className="p-8">
          <EmptyState message="No APIs registered for this provider wallet yet." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['API', 'Method', 'Price', 'Calls', 'Revenue', 'Uptime', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard.apis.map((api) => (
                <tr key={api.id} className="group transition hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-semibold tracking-widest text-gray-600">
                        {api.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{api.name}</p>
                        <p className="text-xs text-gray-500">{api.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={api.method === 'POST' ? 'indigo' : 'neutral'}>{api.method}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {fmt$(api.priceUsdc)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{fmtCompact(api.totalCalls)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{fmt$(api.revenue)}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{fmtPct(api.successRate)}</p>
                    <p className="text-xs text-gray-500">{api.avgLatencyMs}ms</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={api.isActive ? 'green' : 'neutral'}>
                      {api.isActive ? 'Live' : 'Paused'}
                    </Badge>
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

function RegisterTab({
  providerAddress,
  registering,
  registerError,
  registerSuccess,
  onSubmit,
}: {
  providerAddress: string
  registering: boolean
  registerError: string | null
  registerSuccess: string | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      {/* Instructions panel */}
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">How it works</h2>
          <ol className="space-y-4">
            {[
              {
                n: '1',
                title: 'Submit a JSON endpoint',
                body: 'Start with a GET or POST endpoint that returns JSON over HTTPS.',
              },
              {
                n: '2',
                title: 'Set your payout wallet',
                body: 'AgentMarket inserts your Stellar address into the 402 invoice so payments land directly in your wallet.',
              },
              {
                n: '3',
                title: 'Agents call your slug',
                body: 'The resulting endpoint is callable through agstell-sdk by slug, with no SDK update needed.',
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{step.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-xs text-gray-500 leading-relaxed">
            After publishing, your API is live at{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
              /api/proxy/your-slug
            </code>{' '}
            and discoverable in the marketplace.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Register New API</h2>
        <p className="mb-6 text-xs text-gray-500">
          Creates a provider profile if one does not exist, then publishes the API into the marketplace.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Provider section */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Provider
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Provider name *</FieldLabel>
                <Input name="providerName" placeholder="Acme Data Co." required />
              </div>
              <div>
                <FieldLabel>Contact email</FieldLabel>
                <Input name="email" type="email" placeholder="you@example.com" />
              </div>
            </div>
            <div className="mt-4">
              <FieldLabel hint="Shown on your provider profile in the marketplace">
                Provider description
              </FieldLabel>
              <Textarea name="providerDescription" rows={2} placeholder="What does your provider offer?" />
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* API section */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              API Details
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>API name *</FieldLabel>
                <Input name="apiName" placeholder="Real-time Weather" required />
              </div>
              <div>
                <FieldLabel>Method</FieldLabel>
                <Select name="method" defaultValue="GET">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <FieldLabel>Short description *</FieldLabel>
              <Textarea name="description" rows={2} placeholder="One or two sentences describing the API." required />
            </div>
            <div className="mt-4">
              <FieldLabel hint="Used on the marketplace detail page">Long description</FieldLabel>
              <Textarea name="longDescription" rows={3} placeholder="Full description with use cases, data sources, and response format." />
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* Endpoint + pricing */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Endpoint &amp; Pricing
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px_140px]">
              <div>
                <FieldLabel>Endpoint URL *</FieldLabel>
                <Input
                  name="endpoint"
                  type="url"
                  placeholder="https://api.example.com/v1/data"
                  required
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <Select name="category" defaultValue="Data">
                  {['Data', 'AI', 'Finance', 'Geo', 'Utilities', 'News', 'Weather'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel hint="USDC per call">Price *</FieldLabel>
                <Input
                  name="priceUsdc"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="0.001"
                  required
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* Payout wallet */}
          <div>
            <FieldLabel hint="Payments land here directly on Stellar. Must be a valid G… public key.">
              Stellar payout address *
            </FieldLabel>
            <Input
              name="stellarAddress"
              defaultValue={providerAddress || ''}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="font-mono text-xs"
              required
            />
          </div>

          <div className="border-t border-gray-200" />

          {/* Capability spec */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Capability Spec
            </p>
            <p className="mb-4 text-xs text-gray-500">
              Machine-readable contract that helps agents understand your API before calling it.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>Side effects</FieldLabel>
                <Select name="sideEffectLevel" defaultValue="read">
                  <option value="read">Read (no side effects)</option>
                  <option value="write">Write (modifies state)</option>
                  <option value="financial">Financial (moves money)</option>
                  <option value="destructive">Destructive (irreversible)</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Latency</FieldLabel>
                <Select name="latencyHint" defaultValue="fast">
                  <option value="fast">Fast (&lt; 500ms)</option>
                  <option value="medium">Medium (500ms–2s)</option>
                  <option value="slow">Slow (&gt; 2s)</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Idempotent</FieldLabel>
                <Select name="idempotent" defaultValue="true">
                  <option value="true">Yes — safe to retry</option>
                  <option value="false">No — each call is unique</option>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel hint="JSON object with param names as keys. Agents use this to construct requests.">
                Example request
              </FieldLabel>
              <Textarea
                name="exampleRequest"
                rows={3}
                placeholder={'{\n  "city": "Mumbai"\n}'}
                className="font-mono text-xs"
              />
            </div>

            <div className="mt-4">
              <FieldLabel hint="JSON object showing what the API returns. Agents use this to parse responses.">
                Example response
              </FieldLabel>
              <Textarea
                name="exampleResponse"
                rows={3}
                placeholder={'{\n  "temp": 32,\n  "conditions": "Cloudy"\n}'}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {registerError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{registerError}</p>
            </div>
          )}

          {registerSuccess && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-700">{registerSuccess}</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={registering}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registering ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4" /> Publish API
                </>
              )}
            </button>
            <p className="text-xs text-gray-500">
              Goes live in the marketplace immediately.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

function CallsTab({ dashboard }: { dashboard: ProviderDashboardData | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Paid Call History</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Every verified x402 payment recorded for this provider wallet.
        </p>
      </div>

      {!dashboard?.recentCalls.length ? (
        <div className="p-8">
          <EmptyState message="No paid traffic yet. Register an API and run a live SDK call to populate this feed." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['API', 'Caller', 'Amount', 'Latency', 'Time', 'Status', 'TX'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard.recentCalls.map((call) => (
                <tr key={call.id} className="transition hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{call.apiName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-gray-500">
                      {truncateAddress(call.callerAddress)}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                    {fmt$(call.amountUsdc)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {call.latencyMs ? `${call.latencyMs}ms` : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {fmtRelative(call.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    {call.success ? (
                      <Badge variant="green">OK</Badge>
                    ) : (
                      <Badge variant="red">{call.errorMessage ? 'Error' : 'Failed'}</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`https://testnet.stellarchain.io/tx/${call.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900"
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

function SettingsTab({ dashboard }: { dashboard: ProviderDashboardData | null }) {
  const provider = dashboard?.provider

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      {/* Profile card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-gray-900">Provider Profile</h2>
        {provider ? (
          <dl className="space-y-4">
            {[
              { label: 'Name', value: provider.name },
              { label: 'Email', value: provider.email ?? 'Not set' },
              {
                label: 'Wallet',
                value: provider.stellarAddress,
                mono: true,
              },
              {
                label: 'Member since',
                value: new Date(provider.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              },
              {
                label: 'Total earnings',
                value: `${fmt$(provider.totalEarnings)} USDC`,
              },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {label}
                </dt>
                <dd
                  className={`mt-1 break-all text-sm text-gray-700 ${mono ? 'font-mono' : ''}`}
                >
                  {value}
                </dd>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-xs text-gray-700">
                {provider.verified ? 'Verified provider' : 'Profile active and submission-ready'}
              </p>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Load a provider wallet to view your profile.</p>
        )}
      </div>

      {/* Guide */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-gray-900">Dashboard guide</h2>
        <dl className="space-y-4">
          {[
            {
              title: 'Overview',
              body: 'Revenue, traffic, live APIs, and success rate at a glance.',
            },
            {
              title: 'APIs',
              body: 'Every listing with price, call count, revenue, and health metrics.',
            },
            {
              title: 'Register API',
              body: 'Publish a new endpoint into the marketplace — callable immediately via agstell-sdk.',
            },
            {
              title: 'Calls',
              body: 'Full audit trail: tx hash, caller, latency, and status for every paid request.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-lg bg-gray-50 p-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
                {title}
              </dt>
              <dd className="mt-1.5 text-xs text-gray-500 leading-relaxed">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const TABS: { id: ProviderTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'apis', label: 'APIs' },
  { id: 'register', label: 'Register API' },
  { id: 'calls', label: 'Calls' },
  { id: 'settings', label: 'Settings' },
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
    if (!addr) {
      setDashboard(null)
      setDashboardError(null)
      return
    }
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const res = await fetch(
        `/api/provider/dashboard?stellarAddress=${encodeURIComponent(addr)}`
      )
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
      // Parse optional JSON fields
      const rawExReq = String(fd.get('exampleRequest') ?? '').trim()
      const rawExRes = String(fd.get('exampleResponse') ?? '').trim()
      let exampleRequest: Record<string, unknown> | undefined
      let exampleResponse: Record<string, unknown> | undefined
      try { if (rawExReq) exampleRequest = JSON.parse(rawExReq) } catch { /* ignore invalid JSON */ }
      try { if (rawExRes) exampleResponse = JSON.parse(rawExRes) } catch { /* ignore invalid JSON */ }

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
          // Capability spec
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

  const isConnected = Boolean(providerAddress)

  const connectFreighter = async () => {
    setFreighterError(null)
    setFreighterLoading(true)
    try {
      const { isConnected: freighterInstalled, requestAccess, getAddress } =
        await import('@stellar/freighter-api')

      const { isConnected: installed } = await freighterInstalled()
      if (!installed) {
        setFreighterError('Freighter is not installed. Get it at freighter.app')
        return
      }

      await requestAccess()
      const { address, error } = await getAddress()
      if (error || !address) {
        setFreighterError('Could not get address from Freighter. Please approve the request.')
        return
      }

      setAddressInput(address)
      setProviderAddress(address)
      window.localStorage.setItem(STORAGE_KEY, address)
      void loadDashboard(address)
    } catch {
      setFreighterError('Failed to connect Freighter. Make sure the extension is installed and unlocked.')
    } finally {
      setFreighterLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <Nav />

      {/* ── Page content ── */}
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-24">
        {/* Back link */}
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        {/* Page header + wallet connect */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_400px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Provider Dashboard
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-gray-500">
              Register paid APIs, expose them through the marketplace, and track real Stellar USDC earnings.
            </p>
          </div>

          {/* Wallet connect card */}
          <div className="card p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Wallet className="h-3.5 w-3.5" />
              Provider wallet
            </div>

            {/* Freighter button */}
            <button
              onClick={connectFreighter}
              disabled={freighterLoading}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {freighterLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#6366f1"/>
                  <path d="M8 16a8 8 0 1 1 16 0A8 8 0 0 1 8 16zm8-5a5 5 0 1 0 0 10A5 5 0 0 0 16 11zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="white"/>
                </svg>
              )}
              {freighterLoading ? 'Connecting…' : 'Connect Freighter Wallet'}
            </button>

            {freighterError && (
              <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {freighterError}{' '}
                {freighterError.includes('not installed') && (
                  <a href="https://freighter.app" target="_blank" rel="noreferrer" className="underline">
                    Install →
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or enter manually</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connectProvider()}
                placeholder="G… Stellar public key"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
              <button
                onClick={connectProvider}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-700"
              >
                Load
              </button>
              <button
                onClick={() => void loadDashboard(providerAddress)}
                disabled={!providerAddress || dashboardLoading}
                title="Refresh"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {isConnected && (
              <p className="mt-1.5 truncate font-mono text-[10px] text-gray-400">
                {providerAddress}
              </p>
            )}
          </div>
        </div>

        {/* Global alerts */}
        {registerSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">{registerSuccess}</p>
          </div>
        )}
        {dashboardError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-sm text-red-800">{dashboardError}</p>
          </div>
        )}

        {/* ── Tab navigation ── */}
        <div className="mt-8 border-b border-gray-200">
          <nav className="-mb-px flex gap-0">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition ${
                    active
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ── Tab panels ── */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <OverviewTab dashboard={dashboard} onTabChange={setActiveTab} />
          )}
          {activeTab === 'apis' && (
            <ApisTab dashboard={dashboard} onRegister={() => setActiveTab('register')} />
          )}
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
    </main>
  )
}
