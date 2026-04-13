/**
 * AgentMarket CLI - API Client
 * Native XLM payments on Stellar mainnet
 */

import { loadConfig, appendHistory, readRegistryCache, writeRegistryCache } from './config';
import { StellarClient } from './stellar';
import { ApiInfo, CallResult } from './types';

const REGISTRY_TTL_MS = 60 * 60 * 1000 // 1 hour

const FALLBACK_REGISTRY: ApiInfo[] = [
  {
    name: 'Stock Analyst',
    slug: 'stock-analyst',
    description: 'Live Yahoo Finance data + Gemini sentiment analysis',
    category: 'Finance',
    priceXlm: 0.1,
    endpoint: '/api/proxy/stock-analyst',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Trading Advisor',
    slug: 'trading-advisor',
    description: 'Two-stage Gemini reasoning → BUY/HOLD/SELL with targets',
    category: 'Finance',
    priceXlm: 0.5,
    endpoint: '/api/proxy/trading-advisor',
    method: 'GET',
    provider: 'AgentMarket',
  },
];

let _registry: ApiInfo[] = [...FALLBACK_REGISTRY];

interface DiscoverEntry {
  slug: string
  name: string
  description: string
  category: string
  price: { amount: number; asset: string }
  endpoint: string
  method: 'GET' | 'POST'
  provider: { name: string; stellarAddress: string }
  input?: { params: { name: string; type: string; required: boolean; description: string }[] }
}

function toApiInfo(entry: DiscoverEntry): ApiInfo {
  return {
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    category: entry.category,
    priceXlm: entry.price.amount,
    endpoint: entry.endpoint,
    method: entry.method,
    provider: entry.provider.name,
    params: Array.isArray(entry.input?.params) ? entry.input.params : [],
  }
}

export async function refreshRegistry(marketplaceUrl: string): Promise<void> {
  const cached = readRegistryCache()
  if (cached && Date.now() - cached.cachedAt < REGISTRY_TTL_MS) {
    if (Array.isArray(cached.apis) && cached.apis.length > 0) {
      _registry = cached.apis
    }
    return
  }

  try {
    const res = await fetch(`${marketplaceUrl}/api/agents/discover`)
    if (!res.ok) return  // leave _registry unchanged
    const body = await res.json() as { apis?: DiscoverEntry[] }
    if (!Array.isArray(body.apis) || body.apis.length === 0) return  // leave _registry unchanged

    const fresh = body.apis.map(toApiInfo)
    writeRegistryCache(fresh)
    _registry = fresh
  } catch {
    // Network error — leave _registry unchanged
  }
}

// Only for testing: reset _registry to the static fallback
export function _resetRegistryForTesting(): void {
  _registry = [...FALLBACK_REGISTRY]
}

export function listApis(category?: string): ApiInfo[] {
  if (category) {
    return _registry.filter(
      (api) => api.category.toLowerCase() === category.toLowerCase()
    );
  }
  return _registry;
}

export function getApiInfo(slug: string): ApiInfo | undefined {
  return _registry.find((api) => api.slug === slug);
}

function buildRequest(
  api: ApiInfo,
  baseUrl: string,
  params: Record<string, unknown>,
  headers: Record<string, string> = {}
): { url: string; init: RequestInit } {
  const url = new URL(api.endpoint, baseUrl);

  if (api.method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return { url: url.toString(), init: { method: 'GET', headers } };
  }

  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(params),
    },
  };
}

export async function callApi(
  slug: string,
  params: Record<string, unknown>,
  stellarClient: StellarClient
): Promise<CallResult> {
  const startTime = Date.now();
  const api = getApiInfo(slug);

  if (!api) {
    return { success: false, error: `API not found: ${slug}` };
  }

  const config = loadConfig();

  const wallet = await stellarClient.getWalletInfo();
  if (!wallet) {
    return { success: false, error: 'Wallet not configured. Run: agentmarket init' };
  }

  const xlmBalance = parseFloat(wallet.xlmBalance);
  if (xlmBalance < api.priceXlm) {
    return {
      success: false,
      error: `Insufficient XLM balance. Need ${api.priceXlm}, have ${xlmBalance}`,
    };
  }

  // Validate required params before paying
  if (api.params?.length) {
    const missing = api.params
      .filter(p => p.required && (params[p.name] === undefined || params[p.name] === null || params[p.name] === ''))
      .map(p => `  --${p.name} (${p.type}): ${p.description}`)
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required params — no payment made:\n${missing.join('\n')}`,
      };
    }
  }

  const baseUrl = config.marketplaceUrl;
  const initialRequest = buildRequest(api, baseUrl, params);

  try {
    const initialResponse = await fetch(initialRequest.url, initialRequest.init);

    if (initialResponse.status === 402) {
      const paymentDetails = await initialResponse.json() as {
        payment?: { recipient?: string; amount?: string; memo?: string };
      };

      if (!paymentDetails.payment?.recipient || !paymentDetails.payment?.amount) {
        return { success: false, error: 'Invalid 402 response: missing payment recipient or amount' };
      }

      const recipient = paymentDetails.payment.recipient;
      const amount = paymentDetails.payment.amount;
      const memo = paymentDetails.payment?.memo || `am:${slug}:${Date.now()}`;

      const paymentResult = await stellarClient.sendPayment(recipient, amount, memo);

      if (!paymentResult?.success) {
        return { success: false, error: 'Payment failed' };
      }

      const paymentProof = JSON.stringify({
        txHash: paymentResult.txHash,
        network: config.stellarNetwork,
        timestamp: Date.now(),
      });

      const retryRequest = buildRequest(api, baseUrl, params, {
        'X-Payment-Proof': paymentProof,
        'X-Payment-TxHash': paymentResult.txHash,
        'X-Payment-Network': config.stellarNetwork,
      });

      const retryResponse = await fetch(retryRequest.url, retryRequest.init);

      if (!retryResponse.ok) {
        return {
          success: false,
          error: `API call failed: ${retryResponse.status}`,
          txHash: paymentResult.txHash,
          amountPaid: api.priceXlm,
        };
      }

      const data = await retryResponse.json();
      const latencyMs = Date.now() - startTime;

      appendHistory({
        api: slug,
        timestamp: new Date().toISOString(),
        amount: api.priceXlm,
        txHash: paymentResult.txHash,
      });

      return { success: true, data, txHash: paymentResult.txHash, amountPaid: api.priceXlm, latencyMs };
    }

    if (initialResponse.ok) {
      const data = await initialResponse.json();
      return { success: true, data, latencyMs: Date.now() - startTime };
    }

    return { success: false, error: `Unexpected response: ${initialResponse.status}` };
  } catch (error) {
    return {
      success: false,
      error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
