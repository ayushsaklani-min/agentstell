'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Nav } from '@/components/Nav'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
  Zap,
} from 'lucide-react'

interface ApiDef {
  id: string
  name: string
  icon: string
  price: number
  query: Record<string, string>
  color: string
  textColor: string
}

const APIS: ApiDef[] = [
  { id: 'stock-analyst', name: 'Stock Analyst', icon: 'STK', price: 0.1, query: { symbol: 'AAPL' }, color: 'from-blue-50 to-sky-50 border-blue-100', textColor: 'text-blue-600' },
  { id: 'trading-advisor', name: 'Trading Advisor', icon: 'ADV', price: 0.5, query: { symbol: 'TSLA' }, color: 'from-violet-50 to-purple-50 border-violet-100', textColor: 'text-violet-600' },
]

type TxStatus = 'pending' | 'confirmed' | 'success' | 'error'

interface Transaction {
  id: string
  api: string
  amount: number
  status: TxStatus
  timestamp: Date
  txHash?: string
  explorerUrl?: string
  data?: Record<string, unknown>
  error?: string
}

interface WalletInfo {
  publicKey: string
  network: string
  xlm: string
  usdc: string
}

function buildApiUrl(id: string, query: Record<string, string>) {
  return `/api/proxy/${id}?${new URLSearchParams(query)}`
}

// Pre-recorded simulation data — real tx hashes from mainnet calls
const SIM_DATA: Record<string, { txHash: string; explorerUrl: string; data: Record<string, unknown> }> = {
  'stock-analyst': {
    txHash: '9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef',
    explorerUrl: 'https://stellar.expert/explorer/public/tx/9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef',
    data: {
      symbol: 'AAPL', companyName: 'Apple Inc.',
      sentiment: 'bullish',
      reason: 'Strong AI product roadmap and services revenue growth driving investor confidence.',
      price: 213.49, previousClose: 210.62, change: 2.87, changePercent: 1.36,
      volume: 45821300, fiftyTwoWeekHigh: 260.10, fiftyTwoWeekLow: 164.08,
      analysisBy: 'gemini-2.5-flash-lite',
    },
  },
  'trading-advisor': {
    txHash: '9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef',
    explorerUrl: 'https://stellar.expert/explorer/public/tx/9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef',
    data: {
      symbol: 'TSLA', companyName: 'Tesla, Inc.',
      currentPrice: 248.71, changePercent: 2.14,
      recommendation: {
        action: 'BUY', confidence: 72,
        entryTarget: 243.74, exitTarget: 268.61, stopLoss: 236.27,
        timeHorizon: 'medium', riskLevel: 'HIGH',
        reasons: ['Bullish momentum with EV market expansion', 'AI autonomous driving progress', 'Strong quarterly delivery numbers'],
      },
      analysisBy: 'gemini-2.5-flash-lite',
      composition: {
        userPayment: { txHash: '9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef', amount: '0.5 XLM', to: 'Trading Advisor', explorerUrl: 'https://stellar.expert/explorer/public/tx/9a8e1fac30e7959cc8fb508a6a7fc4db19648577d577c53947bffd206c8d2fef' },
        agentPayment: { txHash: '3efaa3265a7bc5ca148e79dd1d616d0e1763303dd808cb0d4691d1073156978c', amount: '0.1 XLM', from: 'Trading Advisor (GCIWVZ3X…)', to: 'Stock Analyst', explorerUrl: 'https://stellar.expert/explorer/public/tx/3efaa3265a7bc5ca148e79dd1d616d0e1763303dd808cb0d4691d1073156978c' },
        stockAnalystSentiment: 'bullish',
        margin: '0.4 XLM captured by Trading Advisor',
      },
    },
  },
}

export default function DemoPage() {
  const [selected, setSelected] = useState('stock-analyst')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [totalSpent, setTotalSpent] = useState(0)
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true)
    setWalletError(null)
    try {
      const res = await fetch('/api/pay')
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'Failed to fetch wallet')
      }
      setWallet(await res.json())
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : 'Failed to load wallet')
    } finally {
      setWalletLoading(false)
    }
  }, [])

  useEffect(() => { fetchWallet() }, [fetchWallet])

  const handleCall = async () => {
    const api = APIS.find((a) => a.id === selected)!
    const url = buildApiUrl(api.id, api.query)
    setLoading(true)
    const txId = Math.random().toString(36).slice(2, 9)
    setTransactions((prev) => [
      { id: txId, api: api.name, amount: api.price, status: 'pending', timestamp: new Date() },
      ...prev,
    ])

    try {
      const step1 = await fetch(url)
      if (step1.status !== 402) throw new Error(`Expected 402, got ${step1.status}`)
      const { payment } = await step1.json()
      if (!payment?.recipient || !payment?.amount) throw new Error('Invalid 402 response')
      const amount = parseFloat(payment.amount)

      const step2 = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: payment.recipient, amount: payment.amount, memo: payment.memo, network: payment.network }),
      })
      if (!step2.ok) { const e = await step2.json(); throw new Error(e.error ?? 'Payment failed') }
      const payData = await step2.json()

      setTransactions((prev) =>
        prev.map((tx) => tx.id === txId ? { ...tx, status: 'confirmed', txHash: payData.txHash, explorerUrl: payData.explorerUrl, amount } : tx)
      )

      const step3 = await fetch(url, {
        headers: {
          'X-Payment-Proof': payData.proofHeader,
          'X-Payment-TxHash': payData.txHash,
          'X-Payment-Network': payData.network,
        },
      })
      if (!step3.ok) throw new Error(`API call failed: ${step3.status}`)
      const data = await step3.json()

      setTransactions((prev) => prev.map((tx) => tx.id === txId ? { ...tx, status: 'success', data } : tx))
      setTotalSpent((s) => s + amount)
      fetchWallet()
    } catch (e) {
      setTransactions((prev) =>
        prev.map((tx) => tx.id === txId ? { ...tx, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' } : tx)
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSimulate = async () => {
    const api = APIS.find((a) => a.id === selected)!
    const sim = SIM_DATA[api.id]
    setLoading(true)
    const txId = Math.random().toString(36).slice(2, 9)

    setTransactions((prev) => [
      { id: txId, api: api.name, amount: api.price, status: 'pending', timestamp: new Date() },
      ...prev,
    ])

    await new Promise((r) => setTimeout(r, 1500))
    setTransactions((prev) =>
      prev.map((tx) => tx.id === txId ? { ...tx, status: 'confirmed', txHash: sim.txHash, explorerUrl: sim.explorerUrl, amount: api.price } : tx)
    )

    await new Promise((r) => setTimeout(r, 1500))
    setTransactions((prev) => prev.map((tx) => tx.id === txId ? { ...tx, status: 'success', data: sim.data } : tx))
    setTotalSpent((s) => s + api.price)
    setLoading(false)
  }

  const selectedApi = APIS.find((a) => a.id === selected)!

  return (
    <main className="min-h-screen bg-gray-50/60">
      <Nav />

      {/* Header */}
      <div className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-6 pt-28">
          <div className="flex items-end justify-between">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-indigo-500">Interactive</p>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Live Demo</h1>
              <p className="mt-1 text-sm text-gray-500">Watch x402 micropayments settle on Stellar in real time.</p>
            </div>
            <Link href="/docs" className="hidden items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors md:flex">
              Read the docs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 lg:grid-cols-3">

          {/* ── Wallet Panel ─────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold text-gray-900">Demo Wallet</h2>
              </div>
              <button onClick={fetchWallet} title="Refresh" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                <RefreshCw className={`h-4 w-4 ${walletLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-6">
              {walletError ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{walletError}</p>
                </div>
              ) : walletLoading && !wallet ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading wallet…
                </div>
              ) : wallet ? (
                <div className="space-y-5">
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Public Key</p>
                    <p className="break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
                      {wallet.publicKey.slice(0, 14)}…{wallet.publicKey.slice(-8)}
                    </p>
                    <a
                      href={`https://stellar.expert/explorer/${wallet.network === 'mainnet' ? 'public' : 'testnet'}/account/${wallet.publicKey}`}
                      target="_blank" rel="noreferrer"
                      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      View on Stellar Expert <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">XLM Balance</p>
                    <p className="text-2xl font-bold text-amber-700">{parseFloat(wallet.xlm).toFixed(4)}</p>
                  </div>

                  <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Session spent</span>
                      <span className="font-bold text-red-600">-{totalSpent.toFixed(4)} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Successful calls</span>
                      <span className="font-bold text-gray-900">{transactions.filter((t) => t.status === 'success').length}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <p className="text-xs font-medium text-emerald-700">Connected · Stellar {wallet.network}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── API Selector ─────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold text-gray-900">Select API</h2>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5 grid grid-cols-2 gap-2.5">
                {APIS.map((api) => {
                  const isSelected = selected === api.id
                  return (
                    <button
                      key={api.id}
                      onClick={() => setSelected(api.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? `bg-gradient-to-br ${api.color} border-2 border-indigo-400 shadow-sm`
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${api.color.split(' border-')[0]}`}>
                        <span className={`text-[9px] font-black tracking-widest ${api.textColor}`}>{api.icon}</span>
                      </div>
                      <p className="mt-2.5 text-xs font-bold text-gray-900">{api.name}</p>
                      <p className="text-[11px] font-mono text-gray-500">{api.price.toFixed(2)} XLM/call</p>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleCall}
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="h-4 w-4" /> Call {selectedApi.name} — Live ({selectedApi.price.toFixed(1)} XLM)
                  </span>
                )}
              </button>

              <button
                onClick={handleSimulate}
                disabled={loading}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" /> Simulate Demo (no XLM)
                </span>
              </button>

              <p className="mt-1 text-center text-xs text-gray-400">
                Simulate replays a real mainnet call — same tx hashes, no spend
              </p>

              {/* Flow steps */}
              <div className="mt-5 space-y-2">
                {[
                  { step: '1', label: 'GET /api/proxy/' + selectedApi.id, hint: 'Returns HTTP 402' },
                  { step: '2', label: 'Pay via Stellar XLM', hint: '~3 second settlement' },
                  { step: '3', label: 'Retry with X-Payment-Proof', hint: 'Server verifies tx hash' },
                ].map(({ step, label, hint }) => (
                  <div key={step} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">{step}</span>
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-gray-700">{label}</p>
                      <p className="text-[10px] text-gray-400">{hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Transaction Feed ─────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold text-gray-900">Transaction Feed</h2>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>

            <div className="p-5">
              {transactions.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                    <Send className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No transactions yet</p>
                  <p className="mt-1 text-xs text-gray-400">Select an API and click Call to start</p>
                </div>
              ) : (
                <div className="max-h-[520px] space-y-3 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`rounded-xl border p-4 transition-all ${
                        tx.status === 'error' ? 'border-red-100 bg-red-50'
                        : tx.status === 'success' ? 'border-emerald-100 bg-emerald-50'
                        : tx.status === 'confirmed' ? 'border-blue-100 bg-blue-50'
                        : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {tx.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
                          {tx.status === 'confirmed' && <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
                          {tx.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {tx.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          <span className="text-sm font-bold text-gray-900">{tx.api}</span>
                        </div>
                        <span className={`flex-shrink-0 font-mono text-sm font-bold ${tx.status === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                          {tx.status === 'error' ? 'FAILED' : `-${tx.amount.toFixed(4)} XLM`}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] text-gray-400">{tx.timestamp.toLocaleTimeString()}</p>

                      {tx.status === 'pending' && (
                        <p className="mt-2 text-xs font-medium text-indigo-600">Sending XLM payment on Stellar…</p>
                      )}
                      {tx.status === 'confirmed' && (
                        <p className="mt-2 text-xs font-medium text-blue-600">Payment confirmed. Fetching data…</p>
                      )}

                      {(tx.status === 'confirmed' || tx.status === 'success') && tx.txHash && (
                        <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                          className="mt-2 flex items-center gap-1 text-xs font-mono font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          TX: {tx.txHash.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      {tx.status === 'success' && tx.data && (
                        <pre className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-white p-3 text-[11px] leading-relaxed text-gray-700 ring-1 ring-gray-200">
                          {JSON.stringify(tx.data, null, 2).slice(0, 320)}
                        </pre>
                      )}

                      {tx.status === 'error' && tx.error && (
                        <p className="mt-2 text-xs text-red-600">{tx.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
