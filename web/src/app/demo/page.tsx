'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Zap, CheckCircle, Clock, Wallet, Send, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';

interface ApiDefinition {
  id: string;
  name: string;
  icon: string;
  price: number;
  query: Record<string, string>;
}

const APIS: ApiDefinition[] = [
  {
    id: 'weather',
    name: 'Weather',
    icon: 'WX',
    price: 0.001,
    query: { city: 'Mumbai' },
  },
  {
    id: 'news',
    name: 'News',
    icon: 'NEWS',
    price: 0.002,
    query: { topic: 'stellar', limit: '3' },
  },
  {
    id: 'ai',
    name: 'AI',
    icon: 'AI',
    price: 0.005,
    query: { prompt: 'Summarize why x402 micropayments are useful for agents.' },
  },
  {
    id: 'currency',
    name: 'Currency',
    icon: 'FX',
    price: 0.001,
    query: { from: 'USD', to: 'INR', amount: '100' },
  },
];

interface Transaction {
  id: string;
  api: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'success' | 'error';
  timestamp: Date;
  txHash?: string;
  explorerUrl?: string;
  data?: Record<string, unknown>;
  error?: string;
}

interface WalletInfo {
  publicKey: string;
  network: string;
  xlm: string;
  usdc: string;
}

function buildApiUrl(apiId: string, query: Record<string, string>) {
  const search = new URLSearchParams(query);
  return `/api/proxy/${apiId}?${search.toString()}`;
}

function getExplorerAccountUrl(network: string, publicKey: string) {
  const networkPath = network === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${networkPath}/account/${publicKey}`;
}

export default function DemoPage() {
  const [selectedApi, setSelectedApi] = useState('weather');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Fetch real wallet balance
  const fetchWalletBalance = useCallback(async () => {
    try {
      setWalletLoading(true);
      setWalletError(null);
      const res = await fetch('/api/pay');
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to fetch wallet');
      }
      const data = await res.json();
      setWallet(data);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const handleApiCall = async () => {
    const api = APIS.find(a => a.id === selectedApi)!;
    const apiUrl = buildApiUrl(api.id, api.query);
    setIsLoading(true);

    // Create pending transaction
    const txId = Math.random().toString(36).substring(7);
    const newTx: Transaction = {
      id: txId,
      api: api.name,
      amount: api.price,
      status: 'pending',
      timestamp: new Date(),
    };
    setTransactions(prev => [newTx, ...prev]);

    try {
      // Step 1: Request the API and receive payment details from the canonical backend.
      const paymentRequiredRes = await fetch(apiUrl);

      if (paymentRequiredRes.status !== 402) {
        const unexpectedBody = await paymentRequiredRes.text();
        throw new Error(
          `Expected 402 Payment Required but received ${paymentRequiredRes.status}: ${unexpectedBody}`
        );
      }

      const paymentRequired = await paymentRequiredRes.json();
      const payment = paymentRequired.payment as
        | { recipient?: string; amount?: string; memo?: string; network?: 'testnet' | 'mainnet' }
        | undefined;

      if (!payment?.recipient || !payment?.amount) {
        throw new Error('Payment details missing from 402 response');
      }

      const paymentAmount = parseFloat(payment.amount);

      // Step 2: Pay the exact 402 invoice via the demo wallet helper.
      const payRes = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: payment.recipient,
          amount: payment.amount,
          memo: payment.memo,
          network: payment.network,
        }),
      });

      if (!payRes.ok) {
        const errData = await payRes.json();
        throw new Error(errData.error || 'Payment failed');
      }

      const payData = await payRes.json();
      
      // Update to confirmed with real tx hash
      setTransactions(prev => prev.map(tx => 
        tx.id === txId ? { 
          ...tx, 
          status: 'confirmed', 
          txHash: payData.txHash,
          explorerUrl: payData.explorerUrl,
          amount: paymentAmount,
        } : tx
      ));

      // Step 3: Retry the API request with the canonical x402 payment proof.
      const apiRes = await fetch(apiUrl, {
        headers: {
          'X-Payment-Proof': payData.proofHeader,
          'X-Payment-TxHash': payData.txHash,
          'X-Payment-Network': payData.network,
        },
      });

      if (!apiRes.ok) {
        const apiError = await apiRes.text();
        throw new Error(`API call failed: ${apiRes.status} ${apiError}`);
      }

      const apiData = await apiRes.json();

      // Update to success with data
      setTransactions(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, status: 'success', data: apiData } : tx
      ));

      setTotalSpent(prev => prev + paymentAmount);
      
      // Refresh wallet balance
      fetchWalletBalance();

    } catch (err) {
      // Update to error status
      setTransactions(prev => prev.map(tx => 
        tx.id === txId ? { 
          ...tx, 
          status: 'error', 
          error: err instanceof Error ? err.message : 'Unknown error' 
        } : tx
      ));
    } finally {
      setIsLoading(false);
    }
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
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/demo" className="text-white font-medium">Live Demo</Link>
            <Link href="/provider" className="text-gray-400 hover:text-white transition">Provider Dashboard</Link>
          </nav>
        </div>
      </header>

      <div className="pt-24 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-3">Live Demo</h1>
            <p className="text-gray-400">Watch x402 payments happen in real-time on Stellar</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel - Wallet */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#6366f1]" />
                  <h2 className="font-semibold">Demo Wallet</h2>
                </div>
                <button 
                  onClick={fetchWalletBalance}
                  className="p-1 hover:bg-[#1f2937] rounded transition"
                  title="Refresh balance"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-400 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {walletError ? (
                <div className="text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {walletError}
                </div>
              ) : walletLoading && !wallet ? (
                <div className="text-gray-500 text-sm">Loading wallet...</div>
              ) : wallet ? (
                <>
                  <div className="mb-6">
                    <div className="text-xs text-gray-500 mb-1">Public Key</div>
                    <div className="font-mono text-sm text-gray-300 break-all">
                      {wallet.publicKey.slice(0, 10)}...{wallet.publicKey.slice(-6)}
                    </div>
                    <a 
                      href={getExplorerAccountUrl(wallet.network, wallet.publicKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#6366f1] hover:underline flex items-center gap-1 mt-1"
                    >
                      View on Stellar Expert <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#1f2937] rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">XLM</div>
                      <div className="text-xl font-semibold">{wallet.xlm}</div>
                    </div>
                    <div className="bg-[#1f2937] rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">USDC</div>
                      <div className="text-xl font-semibold text-green-400">
                        ${wallet.usdc}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1f2937] rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Session Spent</span>
                      <span className="text-yellow-400">${totalSpent.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-400">Successful Calls</span>
                      <span>{transactions.filter(t => t.status === 'success').length}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Connected to Stellar {wallet.network}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Center Panel - API Call */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold">Call API</h2>
              </div>

              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Select API</label>
                <div className="grid grid-cols-2 gap-2">
                  {APIS.map(api => (
                    <button
                      key={api.id}
                      onClick={() => setSelectedApi(api.id)}
                      className={`p-4 rounded-lg text-left transition ${
                        selectedApi === api.id
                          ? 'bg-[#6366f1] border-2 border-[#818cf8]'
                          : 'bg-[#1f2937] border-2 border-transparent hover:border-[#27272a]'
                      }`}
                    >
                      <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-[#0a0a0a] px-3 text-xs font-semibold tracking-[0.18em] text-gray-200">{api.icon}</span>
                      <div className="font-medium mt-1">{api.name}</div>
                      <div className="text-xs text-gray-400">${api.price.toFixed(3)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleApiCall}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Call {APIS.find(a => a.id === selectedApi)?.name} API
                  </>
                )}
              </button>

              <div className="mt-6 text-center text-sm text-gray-500">
                This will send <span className="text-green-400">${APIS.find(a => a.id === selectedApi)?.price.toFixed(3)} USDC</span> via Stellar
              </div>
            </div>

            {/* Right Panel - Transaction Feed */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-blue-400" />
                <h2 className="font-semibold">Transaction Feed</h2>
                <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">LIVE</span>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No transactions yet.</p>
                  <p className="text-sm mt-1">Click &quot;Call API&quot; to start!</p>
                  <p className="text-xs mt-4 text-gray-600">Real USDC payments on Stellar</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {transactions.map((tx) => (
                    <div key={tx.id} className={`bg-[#1f2937] rounded-lg p-4 ${tx.status === 'error' ? 'border border-red-500/30' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {tx.status === 'pending' && (
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                          )}
                          {tx.status === 'confirmed' && (
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          )}
                          {tx.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          )}
                          {tx.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="font-medium">{tx.api}</span>
                        </div>
                        <span className={`text-sm font-mono ${tx.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                          {tx.status === 'error' ? 'FAILED' : `-$${tx.amount.toFixed(3)}`}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        {tx.timestamp.toLocaleTimeString()}
                      </div>

                      {tx.status === 'pending' && (
                        <div className="text-xs text-yellow-400">Sending USDC payment...</div>
                      )}
                      {tx.status === 'confirmed' && tx.txHash && (
                        <div className="text-xs">
                          <span className="text-blue-400">TX confirmed: </span>
                          <a 
                            href={tx.explorerUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#6366f1] hover:underline font-mono"
                          >
                            {tx.txHash.slice(0, 8)}...
                          </a>
                        </div>
                      )}
                      {tx.status === 'success' && tx.data && (
                        <>
                          {tx.txHash && (
                            <div className="text-xs mb-2">
                              <a 
                                href={tx.explorerUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#6366f1] hover:underline flex items-center gap-1"
                              >
                                View on Stellar Expert <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                          <div className="mt-2 p-2 bg-[#0a0a0a] rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(tx.data, null, 2).slice(0, 200)}
                          </div>
                        </>
                      )}
                      {tx.status === 'error' && tx.error && (
                        <div className="text-xs text-red-400 mt-1">{tx.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* x402 Flow Explanation */}
          <div className="mt-10 card p-6">
            <h3 className="font-semibold mb-4">x402 Payment Flow</h3>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-sm font-bold shrink-0">1</div>
                <div>
                  <div className="font-medium">Request API</div>
                  <div className="text-gray-500">GET /api/weather</div>
                </div>
              </div>
                  <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-sm font-bold shrink-0">2</div>
                <div>
                  <div className="font-medium">Get 402</div>
                  <div className="text-gray-500">Payment details in response body</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-sm font-bold shrink-0">3</div>
                <div>
                  <div className="font-medium">Pay via Stellar</div>
                  <div className="text-gray-500">USDC payment ~3 sec</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold shrink-0">4</div>
                <div>
                  <div className="font-medium">Get Data</div>
                  <div className="text-gray-500">Server verifies, returns data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
