import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadConfig, appendHistory, readRegistryCache, writeRegistryCache } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  appendHistory: vi.fn(),
  readRegistryCache: vi.fn(),
  writeRegistryCache: vi.fn(),
}));

vi.mock('./config', () => ({
  loadConfig,
  appendHistory,
  readRegistryCache,
  writeRegistryCache,
}));

import { callApi, getApiInfo, listApis, refreshRegistry, _resetRegistryForTesting } from './api';
import type { StellarClient } from './stellar';

describe('CLI API client', () => {
  beforeEach(() => {
    _resetRegistryForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    appendHistory.mockReset();
    loadConfig.mockReset();
    loadConfig.mockReturnValue({
      marketplaceUrl: 'https://agentmarket.xyz',
      stellarNetwork: 'mainnet',
      budgetLimit: 10,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists APIs by category and preserves canonical methods', () => {
    expect(listApis('Finance')).toHaveLength(2);
    expect(getApiInfo('stock-analyst')?.method).toBe('GET');
    expect(getApiInfo('trading-advisor')?.method).toBe('GET');
  });

  it('returns a clear error when no wallet is configured', async () => {
    const stellarClient = {
      getWalletInfo: vi.fn().mockResolvedValue(null),
    };

    const result = await callApi(
      'stock-analyst',
      { symbol: 'NVDA' },
      stellarClient as unknown as StellarClient
    );

    expect(result).toEqual({
      success: false,
      error: 'Wallet not configured. Run: agentmarket init',
    });
  });

  it('completes the 402 payment retry flow and records history', async () => {
    const stellarClient = {
      getWalletInfo: vi.fn().mockResolvedValue({
        publicKey: 'GTESTPUBLICKEY123',
        network: 'mainnet',
        xlmBalance: '25',
      }),
      sendPayment: vi.fn().mockResolvedValue({
        success: true,
        txHash: 'tx_cli_123',
      }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            payment: {
              recipient: 'GDSTINATION123',
              amount: '0.1',
              memo: 'stock-analyst:cli',
            },
          }),
          {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ symbol: 'NVDA', sentiment: 'bullish' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await callApi(
      'stock-analyst',
      { symbol: 'NVDA' },
      stellarClient as unknown as StellarClient
    );

    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<
      string,
      string
    >;

    expect(stellarClient.sendPayment).toHaveBeenCalledWith(
      'GDSTINATION123',
      '0.1',
      'stock-analyst:cli'
    );
    expect(secondHeaders['X-Payment-TxHash']).toBe('tx_cli_123');
    expect(JSON.parse(secondHeaders['X-Payment-Proof'])).toMatchObject({
      txHash: 'tx_cli_123',
      network: 'mainnet',
    });
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        api: 'stock-analyst',
        txHash: 'tx_cli_123',
        amount: 0.1,
      })
    );
    expect(result).toMatchObject({
      success: true,
      data: { symbol: 'NVDA', sentiment: 'bullish' },
      txHash: 'tx_cli_123',
      amountPaid: 0.1,
    });
  });
});

describe('refreshRegistry', () => {
  beforeEach(() => {
    _resetRegistryForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readRegistryCache.mockReset();
    writeRegistryCache.mockReset();
    loadConfig.mockReturnValue({
      marketplaceUrl: 'https://agentmarket.xyz',
      stellarNetwork: 'mainnet',
      budgetLimit: 10,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses cached registry when cache is fresh (< 1 hour old)', async () => {
    const cachedApis = [
      {
        name: 'Cached API',
        slug: 'cached',
        description: 'From cache',
        category: 'Data',
        priceXlm: 0.1,
        endpoint: '/api/proxy/cached',
        method: 'GET' as const,
        provider: 'TestProvider',
      },
    ];
    readRegistryCache.mockReturnValue({
      cachedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      apis: cachedApis,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await refreshRegistry('https://agentmarket.xyz');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'cached' }));
  });

  it('fetches from discovery endpoint when cache is stale (> 1 hour old)', async () => {
    readRegistryCache.mockReturnValue({
      cachedAt: Date.now() - 90 * 60 * 1000, // 90 minutes ago — stale
      apis: [],
    });
    const freshApis = [
      {
        slug: 'fresh-api',
        name: 'Fresh API',
        description: 'From network',
        category: 'Finance',
        price: { amount: 0.2, asset: 'XLM' },
        endpoint: '/api/proxy/fresh-api',
        method: 'GET',
        input: { params: [], schema: null, example: {} },
        output: { schema: null, example: {} },
        reliability: { sideEffects: 'read', latency: 'fast', idempotent: true, successRate: 99 },
        provider: { name: 'TestProvider', stellarAddress: 'GTEST' },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ version: '1', total: 1, apis: freshApis }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await refreshRegistry('https://agentmarket.xyz');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://agentmarket.xyz/api/agents/discover'
    );
    expect(writeRegistryCache).toHaveBeenCalled();
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'fresh-api' }));
  });

  it('falls back to static registry when fetch fails', async () => {
    readRegistryCache.mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await refreshRegistry('https://agentmarket.xyz');

    // Static fallback has 'stock-analyst'
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'stock-analyst' }));
    expect(writeRegistryCache).not.toHaveBeenCalled();
  });

  it('falls back to static registry when discovery response is non-200', async () => {
    readRegistryCache.mockReturnValue(null);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'service down' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await refreshRegistry('https://agentmarket.xyz');

    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'stock-analyst' }));
  });
});
