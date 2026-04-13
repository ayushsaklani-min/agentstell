'use client'

import Link from 'next/link'
import { Nav } from '@/components/Nav'
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  DollarSign,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react'

const APIS = [
  { name: 'Weather', price: '$0.001', icon: 'WX', desc: 'Real-time weather data for any city', slug: 'weather' },
  { name: 'News', price: '$0.002', icon: 'NEWS', desc: 'Latest headlines by topic', slug: 'news' },
  { name: 'AI Inference', price: '$0.005', icon: 'AI', desc: 'GPT-4 & Claude model queries', slug: 'ai' },
  { name: 'Currency', price: '$0.001', icon: 'FX', desc: 'Live exchange rates', slug: 'currency' },
  { name: 'Geolocation', price: '$0.001', icon: 'GEO', desc: 'IP address to location data', slug: 'geolocation' },
  { name: 'Air Quality', price: '$0.001', icon: 'AQ', desc: 'AQI and pollution metrics', slug: 'air-quality' },
]

const FEATURES = [
  {
    icon: Zap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    title: 'Payment IS Authentication',
    desc: 'No API keys, no accounts. Pay per call in XLM and get instant access.',
  },
  {
    icon: Timer,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: '3-Second Settlement',
    desc: 'Stellar blockchain finalises payments in under 5 seconds globally.',
  },
  {
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    title: 'Sub-cent Micropayments',
    desc: 'Pay as little as $0.001 per call. Viable pricing for AI agent workflows.',
  },
  {
    icon: ShieldCheck,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    title: 'On-Chain Budget Limits',
    desc: 'Soroban smart contracts enforce spending caps so agents never overspend.',
  },
]

const STEPS = [
  { n: '1', title: 'Request API', desc: 'Agent calls any endpoint' },
  { n: '2', title: 'Receive 402', desc: 'Server returns payment details' },
  { n: '3', title: 'Pay via Stellar', desc: 'SDK pays XLM in ~3 seconds' },
  { n: '4', title: 'Get Data', desc: 'Proof verified, data returned' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <Nav />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-5xl text-center">
          {/* Pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Built on Stellar · x402 Protocol · Mainnet Live
          </div>

          <h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
            API Marketplace for{' '}
            <span className="gradient-text">AI Agents</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-500">
            The first marketplace where{' '}
            <strong className="font-semibold text-gray-900">payment IS authentication</strong>.
            No API keys. No subscriptions. Agents pay per call with XLM on Stellar mainnet.
          </p>

          <div className="mb-16 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary px-6 py-3 text-base">
              <Zap className="h-5 w-5" />
              Try Live Demo
            </Link>
            <Link href="/marketplace" className="btn-secondary px-6 py-3 text-base">
              Browse APIs
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/provider" className="btn-secondary px-6 py-3 text-base">
              Launch Dashboard
            </Link>
          </div>

          {/* Code snippet */}
          <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <Code2 className="ml-2 h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Quick Start</span>
            </div>
            <pre className="overflow-x-auto bg-[#1e1e2e] px-5 py-5 text-left text-sm leading-relaxed text-[#cdd6f4]">
{`npm install agstell-sdk

import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({ secretKey: process.env.STELLAR_KEY })

// Pay-per-call — 0.1 XLM, settled on Stellar mainnet
const result = await agent.stockAnalyst('AAPL')
console.log(result.data.sentiment)  // bullish/bearish/neutral
console.log(result.metadata.txHash) // live on Stellar Explorer`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section className="section-alt px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">How x402 Works</h2>
            <p className="mt-3 text-gray-500">
              HTTP 402 &ldquo;Payment Required&rdquo; — finally with a protocol.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute right-0 top-6 hidden h-px w-1/2 translate-x-full bg-gray-200 md:block" />
                )}
                <div className="card p-6 text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white">
                    {step.n}
                  </div>
                  <h3 className="mb-1.5 font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why AgentMarket?</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="card p-6">
                <div className={`mb-4 inline-flex rounded-lg p-2.5 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── API Grid ──────────────────────────────────────── */}
      <section className="section-alt px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Available APIs</h2>
              <p className="mt-2 text-gray-500">Pay-per-call pricing in XLM on Stellar mainnet. No account needed.</p>
            </div>
            <Link href="/marketplace" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              View all →
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {APIS.map((api) => (
              <Link
                key={api.name}
                href={`/marketplace/${api.slug}`}
                className="card group flex flex-col p-5 transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold tracking-widest text-gray-600">
                    {api.icon}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700">
                    {api.price}/call
                  </span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-indigo-700">
                  {api.name}
                </h3>
                <p className="text-sm text-gray-500">{api.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Providers ─────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Agents */}
            <div className="card p-8">
              <div className="mb-4 inline-flex rounded-lg bg-indigo-50 p-2.5">
                <Zap className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="mb-3 text-2xl font-bold text-gray-900">For AI Agents</h2>
              <p className="mb-6 text-gray-500">
                Install the SDK, fund a Stellar mainnet wallet with XLM, and start calling APIs autonomously.
                No sign-ups, no API key management.
              </p>
              <ul className="mb-8 space-y-2.5">
                {[
                  'Auto-pays 402 invoices via Stellar',
                  'Budget limits prevent overspend',
                  'Works headless — no browser needed',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link href="/docs" className="btn-primary text-sm">
                  Read the Docs
                </Link>
                <Link href="/demo" className="btn-secondary text-sm">
                  Try Demo
                </Link>
              </div>
            </div>

            {/* Providers */}
            <div className="card p-8">
              <div className="mb-4 inline-flex rounded-lg bg-violet-50 p-2.5">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="mb-3 text-2xl font-bold text-gray-900">For API Providers</h2>
              <p className="mb-6 text-gray-500">
                Register your API, set an XLM price, and start earning. Payments land directly
                in your Stellar wallet — no intermediaries, no monthly payouts.
              </p>
              <ul className="mb-8 space-y-2.5">
                {[
                  'Payments direct to your Stellar wallet',
                  'Discoverable via agstell-sdk instantly',
                  'Real-time dashboard with call analytics',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/provider" className="btn-primary text-sm">
                Launch Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="section-alt px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Ready to build?</h2>
          <p className="mb-8 text-gray-500">
            Get started in minutes. Install the SDK, fund a Stellar wallet with XLM, and make your first paid API call.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="https://www.npmjs.com/package/agstell-sdk"
              target="_blank"
              rel="noreferrer"
              className="btn-primary px-6 py-3"
            >
              npm install agstell-sdk
            </a>
            <Link href="/docs" className="btn-secondary px-6 py-3">
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-[9px] font-bold tracking-widest text-white">
              AM
            </span>
            <span className="font-bold text-gray-900">AgentMarket</span>
            <span className="text-sm text-gray-400">· Built on Stellar</span>
          </div>

          <nav className="flex items-center gap-6">
            {[
              { href: '/marketplace', label: 'Marketplace' },
              { href: '/docs', label: 'Docs' },
              { href: '/demo', label: 'Demo' },
              { href: '/provider', label: 'Dashboard' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="text-sm text-gray-500 hover:text-gray-900">
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/agentmarket/agentmarket"
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <p className="text-sm text-gray-400">© 2025 AgentMarket · MIT</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
