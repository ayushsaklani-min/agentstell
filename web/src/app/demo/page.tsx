'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Nav } from '@/components/Nav'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react'

interface ApiDef {
  id: string
  name: string
  icon: string
  price: number
  query: Record<string, string>
}

const APIS: ApiDef[] = [
  { id: 'weather', name: 'Weather', icon: 'WX', price: 0.001, query: { city: 'Mumbai' } },
  { id: 'news', name: 'News', icon: 'NEWS', price: 0.002, query: { topic: 'stellar', limit: '3' } },
  { id: 'ai', name: 'AI', icon: 'AI', price: 0.005, query: { prompt: 'Summarize why x402 micropayments are useful for AI agents.' } },
  { id: 'currency', name: 'Currency', icon: 'FX', price: 0.001, query: { from: 'USD', to: 'INR', amount: '100' } },
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

export default function DemoPage() {
  const [selected, setSelected] = useState('weather')
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
      // Step 1 — get 402
      const step1 = await fetch(url)
      if (step1.status !== 402) throw new Error(`Expected 402, got ${step1.status}`)
      const { payment } = await step1.json()
      if (!payment?.recipient || !payment?.amount) throw new Error('Invalid 402 response')
      const amount = parseFloat(payment.amount)

      // Step 2 — pay
      const step2 = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: payment.recipient,
          amount: payment.amount,
          memo: payment.memo,
          network: payment.network,
        }),
      })
      if (!step2.ok) { const e = await step2.json(); throw new Error(e.error ?? 'Payment failed') }
      const payData = await step2.json()

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId ? { ...tx, status: 'confirmed', txHash: payData.txHash, explorerUrl: payData.explorerUrl, amount } : tx
        )
      )

      // Step 3 — retry with proof
      const step3 = await fetch(url, {
        headers: {
          'X-Payment-Proof': payData.proofHeader,
          'X-Payment-TxHash': payData.txHash,
          'X-Payment-Network': payData.network,
        },
      })
      if (!step3.ok) throw new Error(`API call failed: ${step3.status}`)
      const data = await step3.json()

      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? { ...tx, status: 'success', data } : tx))
      )
      setTotalSpent((s) => s + amount)
      fetchWallet()
    } catch (e) {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId ? { ...tx, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' } : tx
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const selectedApi = APIS.find((a) => a.id === selected)!

  return (
    <main className="min-h-screen bg-white">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 pb-16 pt-24">
        <div className="mt-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Live Demo</h1>
          <p className="mt-2 text-gray-500">
            Watch x402 micropayments settle on Stellar in real time.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Wallet panel */}
          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Demo Wallet</h2>
              </div>
              <button
                onClick={fetchWallet}
                title="Refresh"
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${walletLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {walletError ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{walletError}</p>
              </div>
            ) : walletLoading && !wallet ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading wallet…
              </div>
            ) : wallet ? (
              <>
                <div className="mb-5">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Public Key
                  </p>
                  <p className="break-all font-mono text-xs text-gray-700">
                    {wallet.publicKey.slice(0, 12)}…{wallet.publicKey.slice(-6)}
                  </p>
                  <a
                    href={`https://stellar.expert/explorer/${wallet.network === 'mainnet' ? 'public' : 'testnet'}/account/${wallet.publicKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    View on Stellar Expert <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="mb-1 text-xs text-gray-400">XLM</p>
                    <p className="text-lg font-semibold text-gray-900">{wallet.xlm}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="mb-1 text-xs text-gray-400">USDC</p>
                    <p className="text-lg font-semibold text-emerald-700">${wallet.usdc}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Session spent</span>
                    <span className="font-semibold text-gray-900">${totalSpent.toFixed(4)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between">
                    <span className="text-gray-500">Successful calls</span>
                    <span className="font-semibold text-gray-900">
                      {transactions.filter((t) => t.status === 'success').length}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs font-medium text-emerald-800">
                    Connected · Stellar {wallet.network}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* API selector panel */}
          <div className="card p-6">
            <h2 className="mb-5 font-semibold text-gray-900">Select & Call API</h2>

            <div className="mb-5 grid grid-cols-2 gap-2">
              {APIS.map((api) => (
                <button
                  key={api.id}
                  onClick={() => setSelected(api.id)}
                  className={`rounded-xl p-4 text-left transition ${
                    selected === api.id
                      ? 'border-2 border-indigo-500 bg-indigo-50'
                      : 'border border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold tracking-widest text-gray-600">
                    {api.icon}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{api.name}</p>
                  <p className="text-xs text-gray-500">${api.price.toFixed(3)}/call</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleCall}
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="h-4 w-4" />
                  Call {selectedApi.name} API
                </span>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              Sends{' '}
              <span className="font-semibold text-emerald-700">
                ${selectedApi.price.toFixed(3)} USDC
              </span>{' '}
              on Stellar testnet
            </p>
          </div>

          {/* Transaction feed */}
          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Transaction Feed</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                LIVE
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Send className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No transactions yet.</p>
                <p className="mt-1 text-xs text-gray-400">Click &ldquo;Call API&rdquo; to start</p>
              </div>
            ) : (
              <div className="max-h-[480px] space-y-3 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`rounded-xl border p-4 ${
                      tx.status === 'error'
                        ? 'border-red-100 bg-red-50'
                        : tx.status === 'success'
                        ? 'border-emerald-100 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {tx.status === 'pending' && (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        )}
                        {tx.status === 'confirmed' && (
                          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        )}
                        {tx.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        {tx.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{tx.api}</span>
                      </div>
                      <span
                        className={`flex-shrink-0 font-mono text-sm font-semibold ${
                          tx.status === 'error' ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {tx.status === 'error' ? 'FAILED' : `-$${tx.amount.toFixed(3)}`}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-gray-400">{tx.timestamp.toLocaleTimeString()}</p>

                    {tx.status === 'pending' && (
                      <p className="mt-1.5 text-xs text-indigo-600">Sending USDC payment…</p>
                    )}

                    {(tx.status === 'confirmed' || tx.status === 'success') && tx.txHash && (
                      <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        TX: {tx.txHash.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {tx.status === 'success' && tx.data && (
                      <pre className="mt-2.5 overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-700 ring-1 ring-gray-200">
                        {JSON.stringify(tx.data, null, 2).slice(0, 220)}
                      </pre>
                    )}

                    {tx.status === 'error' && tx.error && (
                      <p className="mt-1.5 text-xs text-red-600">{tx.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* x402 flow diagram */}
        <div className="mt-8 card p-6">
          <h3 className="mb-5 font-semibold text-gray-900">x402 Payment Flow</h3>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { n: '1', title: 'Request API', desc: 'Agent calls GET /api/weather' },
              { n: '2', title: 'Receive 402', desc: 'Server returns recipient, amount, memo' },
              { n: '3', title: 'Pay via Stellar', desc: 'Demo wallet sends USDC (~3 sec)' },
              { n: '4', title: 'Get Data', desc: 'Server verifies tx hash, returns data' },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    i === 3 ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}
                >
                  {n}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
