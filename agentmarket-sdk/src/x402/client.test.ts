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
    network: 'testnet',
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
      amount: '0.001',
      currency: 'USDC',
      memo: 'weather:demo',
      network: 'testnet',
      apiId: 'weather',
      apiName: 'Weather',
      expiresAt: Date.now() + 300000,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createPaymentRequiredResponse(payment))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ city: 'Mumbai' }), {
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
      'https://agentmarket.xyz/api/proxy/weather?city=Mumbai',
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
      network: 'testnet',
    })
    expect(result).toMatchObject({
      data: { city: 'Mumbai' },
      txHash: 'tx_402',
      cost: 0.001,
    })
  })

  it('validates payment proofs through the Stellar client', async () => {
    const { client, stellar } = createClient()
    const proof = JSON.stringify({
      txHash: 'tx_123',
      network: 'testnet',
      timestamp: Date.now(),
    })

    stellar.verifyPayment.mockResolvedValue(true)

    const result = await client.validatePaymentProof(
      {
        [X402_HEADERS.PAYMENT_PROOF]: proof,
      },
      'GDSTINATION123',
      '0.001'
    )

    expect(stellar.verifyPayment).toHaveBeenCalledWith(
      'tx_123',
      'GDSTINATION123',
      '0.001'
    )
    expect(result).toEqual({
      valid: true,
      txHash: 'tx_123',
    })
  })
})
