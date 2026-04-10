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

describe('CLI API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    appendHistory.mockReset();
    loadConfig.mockReset();
    loadConfig.mockReturnValue({
      marketplaceUrl: 'https://agentmarket.xyz',
      stellarNetwork: 'testnet',
      budgetLimit: 10,
      contractId: 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists APIs by category and preserves canonical methods', () => {
    expect(listApis('AI')).toHaveLength(1);
    expect(getApiInfo('ai')?.method).toBe('POST');
    expect(getApiInfo('weather')?.method).toBe('GET');
  });

  it('returns a clear error when no wallet is configured', async () => {
    const stellarClient = {
      getWalletInfo: vi.fn().mockResolvedValue(null),
    };

    const result = await callApi(
      'weather',
      { city: 'Mumbai' },
      stellarClient as any
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
        network: 'testnet',
        xlmBalance: '25',
        usdcBalance: '2',
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
              amount: '0.001',
              memo: 'weather:cli',
            },
          }),
          {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ city: 'Mumbai' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await callApi(
      'weather',
      { city: 'Mumbai' },
      stellarClient as any
    );

    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<
      string,
      string
    >;

    expect(stellarClient.sendPayment).toHaveBeenCalledWith(
      'GDSTINATION123',
      '0.001',
      'weather:cli'
    );
    expect(secondHeaders['X-Payment-TxHash']).toBe('tx_cli_123');
    expect(JSON.parse(secondHeaders['X-Payment-Proof'])).toMatchObject({
      txHash: 'tx_cli_123',
      network: 'testnet',
    });
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        api: 'weather',
        txHash: 'tx_cli_123',
        amount: 0.001,
      })
    );
    expect(result).toMatchObject({
      success: true,
      data: { city: 'Mumbai' },
      txHash: 'tx_cli_123',
      amountPaid: 0.001,
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
      stellarNetwork: 'testnet',
      budgetLimit: 10,
      contractId: 'CBCAATFEUDNV43RPERRZ66B76C2HIOJ7LJBG77F4KHAVU527Y3PLHPJB',
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
        priceUsdc: 0.001,
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
        category: 'Data',
        price: { amount: 0.002, asset: 'USDC' },
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

    // Static fallback has 'weather'
    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'weather' }));
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

    expect(listApis()).toContainEqual(expect.objectContaining({ slug: 'weather' }));
  });
});
