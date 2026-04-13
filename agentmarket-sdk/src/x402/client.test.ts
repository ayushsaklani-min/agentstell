import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentDetails } from '../types'
import {
  createPaymentRequiredResponse,
  X402Client,
  X402_HEADERS,
} from './client'

function createClient() {
  const stellar = {
    sendPayment: vi.fn(),
    verifyPayment: vi.fn(),
  }

  const client = new X402Client({
    stellarClient: stellar as any,
    network: 'mainnet',
  })

  return { client, stellar }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('X402Client', () => {
  it('retries a paid request with JSON payment proof headers', async () => {
    const { client, stellar } = createClient()
    const payment: PaymentDetails = {
      recipient: 'GDSTINATION123',
      amount: '0.1',
      currency: 'XLM',
      memo: 'stock-analyst:demo',
      network: 'mainnet',
      apiId: 'stock-analyst',
      apiName: 'Stock Analyst',
      expiresAt: Date.now() + 300000,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createPaymentRequiredResponse(payment))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ symbol: 'NVDA', sentiment: 'bullish' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    stellar.sendPayment.mockResolvedValue({
      success: true,
      txHash: 'tx_402',
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await client.executeWithPayment(
      'https://agentmarket.xyz/api/proxy/stock-analyst?symbol=NVDA',
      { method: 'GET' }
    )

    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<
      string,
      string
    >

    expect(stellar.sendPayment).toHaveBeenCalledWith(
      payment.recipient,
      payment.amount,
      payment.memo
    )
    expect(secondHeaders[X402_HEADERS.PAYMENT_TX_HASH]).toBe('tx_402')
    expect(
      JSON.parse(secondHeaders[X402_HEADERS.PAYMENT_PROOF])
    ).toMatchObject({
      txHash: 'tx_402',
      network: 'mainnet',
    })
    expect(result).toMatchObject({
      data: { symbol: 'NVDA', sentiment: 'bullish' },
      txHash: 'tx_402',
      cost: 0.1,
    })
  })

  it('validates payment proofs through the Stellar client', async () => {
    const { client, stellar } = createClient()
    const proof = JSON.stringify({
      txHash: 'tx_123',
      network: 'mainnet',
      timestamp: Date.now(),
    })

    stellar.verifyPayment.mockResolvedValue(true)

    const result = await client.validatePaymentProof(
      {
        [X402_HEADERS.PAYMENT_PROOF]: proof,
      },
      'GDSTINATION123',
      '0.1'
    )

    expect(stellar.verifyPayment).toHaveBeenCalledWith(
      'tx_123',
      'GDSTINATION123',
      '0.1'
    )
    expect(result).toEqual({
      valid: true,
      txHash: 'tx_123',
    })
  })
})
