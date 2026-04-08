import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadConfig, appendHistory } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  appendHistory: vi.fn(),
}));

vi.mock('./config', () => ({
  loadConfig,
  appendHistory,
}));

import { callApi, getApiInfo, listApis } from './api';

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
