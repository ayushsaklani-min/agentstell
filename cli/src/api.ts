/**
 * AgentMarket CLI - API Client
 */

import { loadConfig, appendHistory } from './config';
import { StellarClient } from './stellar';
import { ApiInfo, CallResult } from './types';

// Mock API registry (in production, fetch from marketplace)
const API_REGISTRY: ApiInfo[] = [
  {
    name: 'Weather',
    slug: 'weather',
    description: 'Get current weather data for any city worldwide',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/weather',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Air Quality',
    slug: 'air-quality',
    description: 'Get real-time air quality index and pollution data',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/air-quality',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'News',
    slug: 'news',
    description: 'Fetch latest news headlines by topic',
    category: 'Data',
    priceUsdc: 0.002,
    endpoint: '/api/proxy/news',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Currency Exchange',
    slug: 'currency',
    description: 'Convert between currencies with live rates',
    category: 'Finance',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/currency',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'Geolocation',
    slug: 'geolocation',
    description: 'Get location data from IP address',
    category: 'Geo',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/geolocation',
    method: 'GET',
    provider: 'AgentMarket',
  },
  {
    name: 'AI Inference',
    slug: 'ai',
    description: 'Run AI inference queries (GPT, Claude)',
    category: 'AI',
    priceUsdc: 0.005,
    endpoint: '/api/proxy/ai',
    method: 'POST',
    provider: 'AgentMarket',
  },
];

export function listApis(category?: string): ApiInfo[] {
  if (category) {
    return API_REGISTRY.filter(
      (api) => api.category.toLowerCase() === category.toLowerCase()
    );
  }
  return API_REGISTRY;
}

export function getApiInfo(slug: string): ApiInfo | undefined {
  return API_REGISTRY.find((api) => api.slug === slug);
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

    return {
      url: url.toString(),
      init: {
        method: 'GET',
        headers,
      },
    };
  }

  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
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
    return {
      success: false,
      error: `API not found: ${slug}`,
    };
  }

  const config = loadConfig();

  // 1. Check wallet balance
  const wallet = await stellarClient.getWalletInfo();
  if (!wallet) {
    return {
      success: false,
      error: 'Wallet not configured. Run: agentmarket init',
    };
  }

  const usdcBalance = parseFloat(wallet.usdcBalance);
  if (usdcBalance < api.priceUsdc) {
    return {
      success: false,
      error: `Insufficient USDC balance. Need ${api.priceUsdc}, have ${usdcBalance}`,
    };
  }

  // 2. Make initial request (will get 402)
  const baseUrl = config.marketplaceUrl;
  const initialRequest = buildRequest(api, baseUrl, params);

  try {
    const initialResponse = await fetch(initialRequest.url, initialRequest.init);

    // 3. If 402, make payment
    if (initialResponse.status === 402) {
      const paymentDetails = await initialResponse.json() as {
        payment?: { recipient?: string; amount?: string; memo?: string };
      };

      if (!paymentDetails.payment?.recipient || !paymentDetails.payment?.amount) {
        return {
          success: false,
          error: 'Invalid 402 response: missing payment recipient or amount',
        };
      }

      const recipient = paymentDetails.payment.recipient;
      const amount = paymentDetails.payment.amount;
      const memo = paymentDetails.payment?.memo || `am:${slug}:${Date.now()}`;

      // Send USDC payment
      const paymentResult = await stellarClient.sendPayment(recipient, amount, memo);
      
      if (!paymentResult?.success) {
        return {
          success: false,
          error: 'Payment failed',
        };
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

      // 4. Retry with payment proof
      const retryResponse = await fetch(retryRequest.url, retryRequest.init);

      if (!retryResponse.ok) {
        return {
          success: false,
          error: `API call failed: ${retryResponse.status}`,
          txHash: paymentResult.txHash,
          amountPaid: api.priceUsdc,
        };
      }

      const data = await retryResponse.json();
      const latencyMs = Date.now() - startTime;

      // Record in history
      appendHistory({
        api: slug,
        timestamp: new Date().toISOString(),
        amount: api.priceUsdc,
        txHash: paymentResult.txHash,
      });

      return {
        success: true,
        data,
        txHash: paymentResult.txHash,
        amountPaid: api.priceUsdc,
        latencyMs,
      };
    }

    // If not 402, API might be free or error
    if (initialResponse.ok) {
      const data = await initialResponse.json();
      return {
        success: true,
        data,
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: `Unexpected response: ${initialResponse.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
