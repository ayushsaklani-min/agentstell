'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Nav } from '@/components/Nav'
import {
  ArrowLeft,
  Book,
  Check,
  Code2,
  Copy,
  Shield,
  Terminal,
  Zap,
  AlertTriangle,
} from 'lucide-react'

type SectionId = 'quickstart' | 'installation' | 'configuration' | 'usage' | 'apis' | 'provider' | 'cli'

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'installation', label: 'Installation', icon: Terminal },
  { id: 'configuration', label: 'Configuration', icon: Shield },
  { id: 'usage', label: 'Basic Usage', icon: Code2 },
  { id: 'apis', label: 'Available APIs', icon: Book },
  { id: 'provider', label: 'Becoming a Provider', icon: Zap },
  { id: 'cli', label: 'CLI Tool', icon: Terminal },
]

function CodeBlock({ code, id, copied, onCopy }: { code: string; id: string; copied: string | null; onCopy: (code: string, id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <button
          onClick={() => onCopy(code, id)}
          className="flex items-center gap-1.5 text-xs text-gray-500 transition hover:text-gray-900"
        >
          {copied === id ? (
            <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#1e1e2e] px-5 py-4 text-sm leading-relaxed text-[#cdd6f4]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <h2 className="mb-4 flex items-center gap-2.5 text-2xl font-bold text-gray-900">
        <Icon className="h-6 w-6 text-indigo-600" />
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function DocsPage() {
  const [active, setActive] = useState<SectionId>('quickstart')
  const [copied, setCopied] = useState<string | null>(null)

  function copy(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const showAll = false // desktop shows all; mobile shows one

  return (
    <main className="min-h-screen bg-white">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-24">
        <div className="mt-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        <div className="mt-8 flex gap-10">
          {/* Sidebar */}
          <aside className="hidden w-56 flex-shrink-0 lg:block">
            <div className="sticky top-28">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Documentation
              </p>
              <nav className="space-y-0.5">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      active === id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h1 className="mb-8 text-4xl font-bold text-gray-900">AgentMarket Documentation</h1>

            {/* Mobile tabs */}
            <div className="mb-8 flex gap-2 overflow-x-auto lg:hidden">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active === id ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Quick Start */}
            <div className={active === 'quickstart' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Quick Start" icon={Zap}>
                <p className="mb-5 text-gray-600">
                  Get up and running in under 5 minutes. Make your first paid API call with just a few lines of code.
                </p>
                <CodeBlock
                  id="qs"
                  copied={copied}
                  onCopy={copy}
                  code={`npm install agstell-sdk

import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({
  secretKey: process.env.STELLAR_SECRET_KEY,
  network: 'testnet',
})

// Payment happens automatically via Stellar
const result = await agent.get('weather', { city: 'Tokyo' })
console.log(result.data)   // { temp: 22, conditions: 'Sunny', ... }
console.log(result.metadata.txHash)  // Stellar transaction hash`}
                />
              </Section>
            </div>

            {/* Installation */}
            <div className={active === 'installation' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Installation" icon={Terminal}>
                <p className="mb-5 text-gray-600">
                  Install <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-indigo-700">agstell-sdk</code> from npm using your preferred package manager.
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'npm', cmd: 'npm install agstell-sdk' },
                    { label: 'yarn', cmd: 'yarn add agstell-sdk' },
                    { label: 'pnpm', cmd: 'pnpm add agstell-sdk' },
                  ].map(({ label, cmd }) => (
                    <div key={label} className="card p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                      <CodeBlock id={`install-${label}`} copied={copied} onCopy={copy} code={cmd} />
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Requirements:</strong> Node.js 18+ and a funded Stellar testnet wallet. Use{' '}
                    <a href="https://laboratory.stellar.org/" target="_blank" rel="noreferrer" className="underline">
                      Stellar Laboratory
                    </a>{' '}
                    or the CLI to generate and fund your wallet.
                  </p>
                </div>
              </Section>
            </div>

            {/* Configuration */}
            <div className={active === 'configuration' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Configuration" icon={Shield}>
                <p className="mb-5 text-gray-600">
                  Configure the SDK with your Stellar wallet and preferred settings.
                </p>
                <CodeBlock
                  id="config"
                  copied={copied}
                  onCopy={copy}
                  code={`import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({
  // Your Stellar secret key (never hardcode — use env vars)
  secretKey: process.env.STELLAR_SECRET_KEY,

  // 'testnet' or 'mainnet' (default: 'testnet')
  network: 'testnet',

  // Optional: spending limits
  budgetLimits: {
    maxPerCall: 0.01,      // Max USDC per single call
    maxPerSession: 1.0,    // Max USDC per SDK session
    maxPerProvider: 0.5,   // Max USDC per provider
  },

  // Optional: custom marketplace base URL
  baseUrl: 'https://agentmarket.xyz',
})`}
                />
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    <strong>Security:</strong> Never hardcode your Stellar secret key in source code.
                    Always use environment variables or a secrets manager.
                  </p>
                </div>
              </Section>
            </div>

            {/* Usage */}
            <div className={active === 'usage' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Basic Usage" icon={Code2}>
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">Making API Calls</h3>
                    <CodeBlock
                      id="calls"
                      copied={copied}
                      onCopy={copy}
                      code={`// Generic call — works for any API slug
const result = await agent.get('api-slug', { param: 'value' })

if (result.success) {
  console.log(result.data)
  console.log(result.metadata.txHash)   // Stellar tx
  console.log(result.metadata.cost)     // USDC paid
} else {
  console.error(result.error)
}

// Typed convenience methods
const weather = await agent.weather('Tokyo')
const news    = await agent.news('AI', 5)
const ai      = await agent.ai('Explain x402')`}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">Discovering APIs</h3>
                    <CodeBlock
                      id="discover"
                      copied={copied}
                      onCopy={copy}
                      code={`// Fetch all available APIs from the marketplace
const apis = await agent.discoverApis()
console.log(apis.map(a => a.slug))   // ['weather', 'ai', 'my-custom-api', ...]

// Call any discovered API by slug — no SDK update needed
const result = await agent.invoke('my-custom-api', { input: 'hello' })`}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">Budget Management</h3>
                    <CodeBlock
                      id="budget"
                      copied={copied}
                      onCopy={copy}
                      code={`// Check spending
const budget = agent.getBudgetStatus()
console.log(budget.spent)      // 0.003 USDC
console.log(budget.remaining)  // 0.997 USDC

// Adjust limits mid-session
agent.setBudgetLimits({ maxPerSession: 2.0 })

// Reset session counter
agent.resetSession()`}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">Event Handling</h3>
                    <CodeBlock
                      id="events"
                      copied={copied}
                      onCopy={copy}
                      code={`const unsubscribe = agent.on((event) => {
  switch (event.type) {
    case 'api_call':
      console.log('Calling', event.data.apiName)
      break
    case 'payment_confirmed':
      console.log('TX:', event.data.txHash)
      break
    case 'budget_warning':
      console.warn('Low budget:', event.data.remaining, 'USDC left')
      break
    case 'error':
      console.error(event.data.error)
      break
  }
})

// Later: remove the listener
unsubscribe()`}
                    />
                  </div>
                </div>
              </Section>
            </div>

            {/* APIs */}
            <div className={active === 'apis' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Available APIs" icon={Book}>
                <p className="mb-5 text-gray-600">
                  These APIs are built into the SDK. Additional APIs registered by providers are discovered
                  automatically via <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-indigo-700">agent.discoverApis()</code>.
                </p>
                <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {[
                    { slug: 'weather', price: 0.001, desc: 'Weather data for any city worldwide', params: 'city: string' },
                    { slug: 'news', price: 0.002, desc: 'Latest headlines by topic', params: 'topic: string, limit?: number' },
                    { slug: 'ai', price: 0.005, desc: 'AI model inference (GPT-4, Claude)', params: 'prompt: string, model?: string' },
                    { slug: 'currency', price: 0.001, desc: 'Real-time exchange rates', params: 'from: string, to: string, amount?: number' },
                    { slug: 'geolocation', price: 0.001, desc: 'IP address to location data', params: 'ip?: string' },
                    { slug: 'air-quality', price: 0.001, desc: 'AQI and pollution metrics', params: 'city: string' },
                    { slug: 'agent-test', price: 0.001, desc: 'Controlled endpoint for SDK validation', params: 'task?: string, agentId?: string' },
                  ].map((api) => (
                    <div key={api.slug} className="flex items-center justify-between gap-4 bg-white px-5 py-4">
                      <div className="min-w-0">
                        <code className="font-mono text-sm font-semibold text-indigo-700">{api.slug}</code>
                        <p className="mt-0.5 text-sm text-gray-500">{api.desc}</p>
                        <p className="mt-1 font-mono text-xs text-gray-400">params: {`{ ${api.params} }`}</p>
                      </div>
                      <span className="flex-shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700">
                        ${api.price.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Provider */}
            <div className={active === 'provider' || showAll ? '' : 'hidden lg:block'}>
              <Section title="Becoming a Provider" icon={Zap}>
                <p className="mb-5 text-gray-600">
                  Register any JSON API into the marketplace. Agents can call it by slug immediately —
                  payments go directly to your Stellar wallet.
                </p>
                <ol className="mb-6 space-y-4">
                  {[
                    {
                      n: '1',
                      title: 'Have a Stellar wallet',
                      body: 'Use Freighter browser extension or generate one via the CLI. This is your payout address.',
                    },
                    {
                      n: '2',
                      title: 'Open the Provider Dashboard',
                      body: 'Go to /provider, connect your wallet address, and click Register API.',
                    },
                    {
                      n: '3',
                      title: 'Fill in your API details',
                      body: 'Enter your endpoint URL (must be HTTPS), price in USDC, category, and description.',
                    },
                    {
                      n: '4',
                      title: 'Publish',
                      body: 'Your API is live immediately. Agents can call it via agstell-sdk with agent.invoke("your-slug").',
                    },
                  ].map(({ n, title, body }) => (
                    <li key={n} className="flex gap-4">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                        {n}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">{title}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Link
                  href="/provider"
                  className="btn-primary text-sm"
                >
                  Open Provider Dashboard →
                </Link>
              </Section>
            </div>

            {/* CLI */}
            <div className={active === 'cli' || showAll ? '' : 'hidden lg:block'}>
              <Section title="CLI Tool" icon={Terminal}>
                <p className="mb-5 text-gray-600">
                  The AgentMarket CLI lets you interact with the marketplace from your terminal —
                  useful for testing, wallet management, and scripted agent workflows.
                </p>
                <CodeBlock
                  id="cli"
                  copied={copied}
                  onCopy={copy}
                  code={`# Install globally
npm install -g agentmarket-cli

# Initialise — generates a Stellar keypair and saves to ~/.agentmarket/config.json
agentmarket init

# Fund on Stellar testnet via Friendbot
agentmarket fund

# List available APIs
agentmarket list

# Call an API (pays automatically)
agentmarket call weather --city Mumbai
agentmarket call news --topic stellar --limit 3

# Check wallet balance
agentmarket balance

# View paid call history
agentmarket history`}
                />
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    The CLI uses the same Stellar wallet config as the SDK.
                    Your secret key is stored at{' '}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-indigo-700">
                      ~/.agentmarket/config.json
                    </code>.
                    The SDK reads it automatically if{' '}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-indigo-700">
                      AGENTMARKET_TEST_SECRET_KEY
                    </code>{' '}
                    is not set.
                  </p>
                </div>
              </Section>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-8 text-center">
              <p className="text-sm text-gray-500">
                Something missing?{' '}
                <a
                  href="https://github.com/agentmarket/agentmarket/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Open an issue on GitHub
                </a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
