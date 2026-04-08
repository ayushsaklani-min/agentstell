'use client';

import Link from 'next/link';
import { Zap, Shield, Clock, DollarSign, Code, ArrowRight } from 'lucide-react';

const APIS = [
  { name: 'Weather', price: '$0.001', icon: 'WX', desc: 'Real-time weather data' },
  { name: 'News', price: '$0.002', icon: 'NEWS', desc: 'Latest headlines' },
  { name: 'AI', price: '$0.005', icon: 'AI', desc: 'GPT-4, Claude inference' },
  { name: 'Currency', price: '$0.001', icon: 'FX', desc: 'Live exchange rates' },
  { name: 'Geolocation', price: '$0.001', icon: 'GEO', desc: 'IP to location' },
  { name: 'Air Quality', price: '$0.001', icon: 'AQ', desc: 'AQI & pollution data' },
];

const FEATURES = [
  {
    icon: <Zap className="w-6 h-6 text-yellow-400" />,
    title: 'Payment IS Authentication',
    desc: 'No API keys, no accounts, no subscriptions. Just pay and use.',
  },
  {
    icon: <Clock className="w-6 h-6 text-blue-400" />,
    title: '3-Second Finality',
    desc: 'Stellar blockchain settles payments in under 5 seconds.',
  },
  {
    icon: <DollarSign className="w-6 h-6 text-green-400" />,
    title: 'Micropayments',
    desc: 'Pay $0.001 per API call. Sub-cent fees make it viable.',
  },
  {
    icon: <Shield className="w-6 h-6 text-purple-400" />,
    title: 'On-Chain Budget Limits',
    desc: 'Smart contracts enforce spending limits automatically.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1f2937] text-[10px] font-semibold tracking-[0.18em] text-white">AM</span>
            <span className="font-bold text-xl">AgentMarket</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-gray-400 hover:text-white transition">Marketplace</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/demo" className="text-gray-400 hover:text-white transition">Live Demo</Link>
            <Link href="/provider" className="text-gray-400 hover:text-white transition">Provider Dashboard</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="https://github.com" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </Link>
            <Link href="/demo" className="btn-primary text-sm">
              Try Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1f2937] text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Built on Stellar • x402 Protocol
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            API Marketplace for{' '}
            <span className="gradient-text">AI Agents</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            The first marketplace where <strong className="text-white">payment IS authentication</strong>. 
            No API keys. No subscriptions. Just pay-per-call with USDC.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/demo" className="btn-primary flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              Try Live Demo
            </Link>
            <Link href="/marketplace" className="btn-secondary flex items-center justify-center gap-2">
              Browse APIs
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/provider" className="btn-secondary flex items-center justify-center gap-2">
              Launch Dashboard
            </Link>
          </div>

          {/* Code Example */}
          <div className="card p-6 text-left max-w-2xl mx-auto glow">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">Install & Use</span>
            </div>
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-300">
{`npm install agstell-sdk

import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({ secretKey: '...' })

// Get weather - automatically pays via Stellar
const weather = await agent.get('weather', { city: 'Tokyo' })
// Cost: $0.001 USDC`}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How x402 Works</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            HTTP 402 &quot;Payment Required&quot; finally has a use case
          </p>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Request API', desc: 'Agent calls any API endpoint' },
              { step: '2', title: 'Get 402', desc: 'Server returns payment details' },
              { step: '3', title: 'Pay USDC', desc: 'SDK pays via Stellar (~3 sec)' },
              { step: '4', title: 'Get Data', desc: 'Server verifies & returns data' },
            ].map((item) => (
              <div key={item.step} className="card p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-[#6366f1] flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why AgentMarket?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card p-6">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Grid */}
      <section className="py-20 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Available APIs</h2>
              <p className="text-gray-400">Pay-per-call pricing in USDC</p>
            </div>
            <Link href="/marketplace" className="btn-secondary text-sm">
              View All
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {APIS.map((api) => (
              <Link key={api.name} href={`/marketplace/${api.name.toLowerCase()}`} className="card p-6 hover:border-[#6366f1] transition">
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-[#1f2937] px-3 text-xs font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span>
                  <span className="text-green-400 font-mono text-sm">{api.price}/call</span>
                </div>
                <h3 className="font-semibold mb-1">{api.name}</h3>
                <p className="text-sm text-gray-400">{api.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Build?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Get started in minutes. Install the SDK, fund your wallet, and start making API calls.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://www.npmjs.com/package/agstell-sdk" className="btn-primary">
              npm install agstell-sdk
            </a>
            <Link href="/docs" className="btn-secondary">
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#1f2937] text-[10px] font-semibold tracking-[0.18em] text-white">AM</span>
            <span className="font-bold">AgentMarket</span>
            <span className="text-gray-500 text-sm ml-2">Built on Stellar</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="https://github.com" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </Link>
            <Link href="https://twitter.com" className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </Link>
          </div>
          <p className="text-gray-500 text-sm">© 2024 AgentMarket. MIT License.</p>
        </div>
      </footer>
    </main>
  );
}
