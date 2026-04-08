'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Book, Code, Zap, Shield, Terminal, Copy, Check } from 'lucide-react';

const sections = [
  { id: 'quickstart', title: 'Quick Start', icon: Zap },
  { id: 'installation', title: 'Installation', icon: Terminal },
  { id: 'configuration', title: 'Configuration', icon: Shield },
  { id: 'usage', title: 'Basic Usage', icon: Code },
  { id: 'apis', title: 'Available APIs', icon: Book },
  { id: 'cli', title: 'CLI Tool', icon: Terminal },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

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
            <Link href="/docs" className="text-white font-medium">Docs</Link>
            <Link href="/demo" className="text-gray-400 hover:text-white transition">Live Demo</Link>
            <Link href="/provider" className="text-gray-400 hover:text-white transition">Provider Dashboard</Link>
          </nav>
          <Link href="/demo" className="btn-primary text-sm">Try Demo</Link>
        </div>
      </header>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-28">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Documentation</h3>
                <nav className="space-y-1">
                  {sections.map(section => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition ${
                          activeSection === section.id
                            ? 'bg-[#6366f1] text-white'
                            : 'text-gray-400 hover:bg-[#1f2937] hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {section.title}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <div className="flex-1 max-w-4xl">
              <h1 className="text-4xl font-bold mb-8">AgentMarket SDK Documentation</h1>

              {/* Quick Start */}
              <section id="quickstart" className={activeSection === 'quickstart' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-[#6366f1]" />
                  Quick Start
                </h2>
                <p className="text-gray-400 mb-4">
                  Get up and running with AgentMarket in under 5 minutes. Make your first paid API call with just a few lines of code.
                </p>
                <div className="card p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Install & Use</span>
                    <button
                      onClick={() => copyCode(`npm install agstell-sdk

import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({ 
  secretKey: 'SBXXX...YOUR_SECRET_KEY',
  network: 'testnet'
})

const weather = await agent.get('weather', { city: 'Mumbai' })
console.log(weather.data)`, 'quickstart')}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                    >
                      {copied === 'quickstart' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'quickstart' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`npm install agstell-sdk

import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({ 
  secretKey: 'SBXXX...YOUR_SECRET_KEY',
  network: 'testnet'
})

const weather = await agent.get('weather', { city: 'Mumbai' })
console.log(weather.data)`}</code>
                  </pre>
                </div>
              </section>

              {/* Installation */}
              <section id="installation" className={activeSection === 'installation' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-10">
                  <Terminal className="w-6 h-6 text-[#6366f1]" />
                  Installation
                </h2>
                <div className="space-y-4">
                  <div className="card p-4">
                    <h4 className="font-medium mb-2">npm</h4>
                    <pre className="bg-[#1f2937] rounded p-3 text-sm">
                      <code>npm install agstell-sdk</code>
                    </pre>
                  </div>
                  <div className="card p-4">
                    <h4 className="font-medium mb-2">yarn</h4>
                    <pre className="bg-[#1f2937] rounded p-3 text-sm">
                      <code>yarn add agstell-sdk</code>
                    </pre>
                  </div>
                  <div className="card p-4">
                    <h4 className="font-medium mb-2">pnpm</h4>
                    <pre className="bg-[#1f2937] rounded p-3 text-sm">
                      <code>pnpm add agstell-sdk</code>
                    </pre>
                  </div>
                </div>
              </section>

              {/* Configuration */}
              <section id="configuration" className={activeSection === 'configuration' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-10">
                  <Shield className="w-6 h-6 text-[#6366f1]" />
                  Configuration
                </h2>
                <p className="text-gray-400 mb-4">
                  Configure the SDK with your Stellar wallet credentials and preferred network.
                </p>
                <div className="card p-4 mb-4">
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`import { AgentMarket } from 'agstell-sdk'

const agent = new AgentMarket({
  // Required: Your Stellar secret key
  secretKey: process.env.STELLAR_SECRET_KEY,
  
  // Network: 'testnet' or 'mainnet' (default: testnet)
  network: 'testnet',
  
  // Optional: Budget limits
  budgetLimits: {
    maxPerCall: 0.01,
    maxPerSession: 1.0,
    maxPerProvider: 0.5,
  },
  
  // Optional: Custom marketplace base URL
  baseUrl: 'https://agentmarket.xyz',
})`}</code>
                  </pre>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm">
                    <strong>Security:</strong> Never hardcode your secret key. Always use environment variables.
                  </p>
                </div>
              </section>

              {/* Usage */}
              <section id="usage" className={activeSection === 'usage' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-10">
                  <Code className="w-6 h-6 text-[#6366f1]" />
                  Basic Usage
                </h2>
                
                <h3 className="text-lg font-semibold mb-3">Making API Calls</h3>
                <div className="card p-4 mb-6">
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`// Generic API call
const result = await agent.get('api-name', { param: 'value' })

// Convenience methods
const weather = await agent.weather('Tokyo')
const news = await agent.news('AI', 5)
const ai = await agent.ai('Explain quantum computing')`}</code>
                  </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Budget Management</h3>
                <div className="card p-4 mb-6">
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`// Check current budget status
const budget = agent.getBudgetStatus()
console.log(\`Remaining: $\${budget.remaining} USDC\`)

// Update spending limits
agent.setBudgetLimits({ maxPerSession: 2.0 })

// Reset session tracking
agent.resetSession()`}</code>
                  </pre>
                </div>

                <h3 className="text-lg font-semibold mb-3">Event Handling</h3>
                <div className="card p-4 mb-6">
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`agent.on((event) => {
  switch (event.type) {
    case 'api_call':
      console.log(\`Calling \${event.data.apiName}...\`)
      break
    case 'payment_confirmed':
      console.log(\`TX: \${event.data.txHash}\`)
      break
    case 'error':
      console.error(event.data.error)
      break
  }
})`}</code>
                  </pre>
                </div>
              </section>

              {/* APIs */}
              <section id="apis" className={activeSection === 'apis' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-10">
                  <Book className="w-6 h-6 text-[#6366f1]" />
                  Available APIs
                </h2>
                <div className="grid gap-4">
                  {[
                    { name: 'weather', price: 0.001, desc: 'Get weather data for any city' },
                    { name: 'news', price: 0.002, desc: 'Fetch news headlines by topic' },
                    { name: 'ai', price: 0.005, desc: 'AI inference (GPT-4, Claude)' },
                    { name: 'currency', price: 0.001, desc: 'Real-time exchange rates' },
                    { name: 'geolocation', price: 0.001, desc: 'IP to location lookup' },
                    { name: 'air-quality', price: 0.001, desc: 'Air quality index data' },
                  ].map(api => (
                    <div key={api.name} className="card p-4 flex items-center justify-between">
                      <div>
                        <code className="text-[#6366f1]">{api.name}</code>
                        <p className="text-sm text-gray-400 mt-1">{api.desc}</p>
                      </div>
                      <div className="text-green-400">${api.price.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* CLI */}
              <section id="cli" className={activeSection === 'cli' ? '' : 'hidden lg:block'}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 mt-10">
                  <Terminal className="w-6 h-6 text-[#6366f1]" />
                  CLI Tool
                </h2>
                <p className="text-gray-400 mb-4">
                  The AgentMarket CLI lets you interact with the marketplace from your terminal.
                </p>
                <div className="card p-4">
                  <pre className="bg-[#1f2937] rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-gray-300">{`# Install globally
npm install -g agentmarket-cli

# Initialize with your wallet
agentmarket init

# List available APIs
agentmarket list

# Call an API
agentmarket call weather --city Mumbai

# Check balance
agentmarket balance

# View transaction history
agentmarket history`}</code>
                  </pre>
                </div>
              </section>

              {/* Footer */}
              <div className="mt-16 pt-8 border-t border-[#27272a]">
                <p className="text-gray-400 text-center">
                  Need help? Join our{' '}
                  <a href="#" className="text-[#6366f1] hover:underline">Discord community</a>
                  {' '}or check out the{' '}
                  <a href="https://github.com" className="text-[#6366f1] hover:underline">GitHub repository</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
