/**
 * x402 Payment Protocol Implementation
 * Handles HTTP 402 Payment Required flow
 */

import type { PaymentDetails, PaymentProof, NetworkType } from '../types'
import { StellarClient } from '../stellar/client'

// x402 Header names
export const X402_HEADERS = {
  PAYMENT_PROOF: 'X-Payment-Proof',
  PAYMENT_TX_HASH: 'X-Payment-TxHash',
  PAYMENT_NETWORK: 'X-Payment-Network',
} as const

export interface X402Config {
  stellarClient: StellarClient
  network: NetworkType
  debug?: boolean
}

export class X402Client {
  private stellar: StellarClient
  private network: NetworkType
  private debug: boolean

  constructor(config: X402Config) {
    this.stellar = config.stellarClient
    this.network = config.network
    this.debug = config.debug ?? false
  }

  /**
   * Execute an x402 payment flow:
   * 1. Make initial request
   * 2. If 402 returned, extract payment details
   * 3. Send payment via Stellar
   * 4. Retry request with payment proof
   */
  async executeWithPayment<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ data: T; txHash: string; cost: number }> {
    // Step 1: Make initial request
    const initialResponse = await this.makeRequest(url, options)

    // If not 402, just return the data
    if (initialResponse.status !== 402) {
      if (!initialResponse.ok) {
        throw new Error(`API error: ${initialResponse.status} ${initialResponse.statusText}`)
      }
      const data = await initialResponse.json() as T
      return { data, txHash: '', cost: 0 }
    }

    // Step 2: Parse 402 response for payment details
    const paymentDetails = await this.parsePaymentRequired(initialResponse)
    
    if (this.debug) {
      console.log('[x402] Payment required:', paymentDetails)
    }

    // Step 3: Send payment via Stellar
    const paymentResult = await this.stellar.sendPayment(
      paymentDetails.recipient,
      paymentDetails.amount,
      paymentDetails.memo
    )

    if (!paymentResult.success || !paymentResult.txHash) {
      throw new Error(`Payment failed: ${paymentResult.error}`)
    }

    if (this.debug) {
      console.log('[x402] Payment sent:', paymentResult.txHash)
    }

    // Step 4: Retry request with payment proof
    const proof: PaymentProof = {
      txHash: paymentResult.txHash,
      network: this.network,
      timestamp: Date.now(),
    }

    const retryResponse = await this.makeRequest(url, {
      ...options,
      headers: {
        ...options.headers,
        ...this.createPaymentProofHeaders(proof),
      },
    })

    if (!retryResponse.ok) {
      throw new Error(`API error after payment: ${retryResponse.status}`)
    }

    const data = await retryResponse.json() as T
    
    return {
      data,
      txHash: paymentResult.txHash,
      cost: parseFloat(paymentDetails.amount),
    }
  }

  /**
   * Parse a 402 Payment Required response
   */
  private async parsePaymentRequired(response: Response): Promise<PaymentDetails> {
    try {
      const body = await response.json() as { payment?: Record<string, unknown> }
      
      if (!body.payment) {
        throw new Error('Invalid 402 response: missing payment details')
      }

      const payment = body.payment
      
      // Validate required fields
      if (!payment.recipient || !payment.amount) {
        throw new Error('Invalid payment details: missing recipient or amount')
      }

      return {
        recipient: String(payment.recipient),
        amount: String(payment.amount),
        currency: (payment.currency as 'USDC') ?? 'USDC',
        memo: String(payment.memo ?? ''),
        network: (payment.network as NetworkType) ?? this.network,
        apiId: String(payment.apiId ?? ''),
        apiName: String(payment.apiName ?? ''),
        expiresAt: Number(payment.expiresAt) || Date.now() + 300000, // 5 min default
      }
    } catch (error) {
      throw new Error(`Failed to parse 402 response: ${error}`)
    }
  }

  /**
   * Create headers with payment proof
   */
  private createPaymentProofHeaders(proof: PaymentProof): Record<string, string> {
    return {
      [X402_HEADERS.PAYMENT_PROOF]: JSON.stringify(proof),
      [X402_HEADERS.PAYMENT_TX_HASH]: proof.txHash,
      [X402_HEADERS.PAYMENT_NETWORK]: proof.network,
    }
  }

  /**
   * Validate incoming payment proof (for server-side use)
   */
  async validatePaymentProof(
    headers: Headers | Record<string, string>,
    expectedRecipient: string,
    expectedAmount: string
  ): Promise<{ valid: boolean; txHash?: string; error?: string }> {
    try {
      // Extract proof from headers
      const proofHeader = headers instanceof Headers 
        ? headers.get(X402_HEADERS.PAYMENT_PROOF)
        : headers[X402_HEADERS.PAYMENT_PROOF]

      if (!proofHeader) {
        return { valid: false, error: 'Missing payment proof header' }
      }

      const proof: PaymentProof = JSON.parse(proofHeader)

      // Check timestamp (prevent replay attacks - max 5 minutes old)
      const maxAge = 5 * 60 * 1000 // 5 minutes
      if (Date.now() - proof.timestamp > maxAge) {
        return { valid: false, error: 'Payment proof expired' }
      }

      // Verify on Stellar
      const isValid = await this.stellar.verifyPayment(
        proof.txHash,
        expectedRecipient,
        expectedAmount
      )

      if (!isValid) {
        return { valid: false, error: 'Payment verification failed' }
      }

      return { valid: true, txHash: proof.txHash }
    } catch (error) {
      return { 
        valid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}` 
      }
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }
}

/**
 * Create a 402 Payment Required response (for API providers)
 */
export function createPaymentRequiredResponse(
  payment: PaymentDetails
): Response {
  return new Response(
    JSON.stringify({
      error: 'Payment Required',
      message: `This API requires payment of ${payment.amount} ${payment.currency}`,
      payment,
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
