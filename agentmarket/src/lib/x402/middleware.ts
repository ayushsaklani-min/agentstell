/**
 * x402 Payment Middleware for Next.js API Routes
 * Verifies payment proofs and returns 402 Payment Required when needed
 */

import { NextRequest, NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'

// x402 Header names
export const X402_HEADERS = {
  PAYMENT_PROOF: 'X-Payment-Proof',
  PAYMENT_TX_HASH: 'X-Payment-TxHash',
  PAYMENT_NETWORK: 'X-Payment-Network',
} as const

// Network configurations
const NETWORKS = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
  },
}

// USDC Assets
const USDC = {
  testnet: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  mainnet: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
}

// AgentMarket wallet (receives payments)
const AGENTMARKET_WALLET = process.env.AGENTMARKET_WALLET_PUBLIC || 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3VQXTWLHKMIS'

// Payment proof interface
interface PaymentProof {
  txHash: string
  network: 'testnet' | 'mainnet'
  timestamp: number
}

export interface PaymentVerificationResult {
  valid: boolean
  txHash?: string
  callerAddress?: string
  network?: 'testnet' | 'mainnet'
  amount?: number
  error?: string
}

interface PaymentVerificationOptions {
  recipient?: string
  network?: 'testnet' | 'mainnet'
}

interface X402PaymentOptions extends PaymentVerificationOptions {
  memo?: string
}

// Used transaction cache (prevent replay attacks)
const usedTransactions = new Set<string>()

/**
 * Create a 402 Payment Required response
 */
export function paymentRequired(
  apiName: string,
  apiId: string,
  priceUsdc: number,
  network: 'testnet' | 'mainnet' = 'testnet',
  recipient: string = AGENTMARKET_WALLET,
  memo: string = `agentmarket:${apiId}`
): NextResponse {
  return NextResponse.json(
    {
      error: 'Payment Required',
      message: `This API requires a payment of ${priceUsdc} USDC`,
      payment: {
        recipient,
        amount: priceUsdc.toFixed(6),
        currency: 'USDC',
        memo,
        network,
        apiId,
        apiName,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      },
    },
    { status: 402 }
  )
}

/**
 * Verify payment proof from request headers
 */
export async function verifyPayment(
  request: NextRequest,
  expectedAmount: number,
  options: PaymentVerificationOptions = {}
): Promise<PaymentVerificationResult> {
  // Extract payment proof header
  const proofHeader = request.headers.get(X402_HEADERS.PAYMENT_PROOF)
  
  if (!proofHeader) {
    return { valid: false, error: 'Missing payment proof' }
  }

  try {
    const proof: PaymentProof = JSON.parse(proofHeader)

    // Check timestamp (max 5 minutes old)
    const maxAge = 5 * 60 * 1000
    if (Date.now() - proof.timestamp > maxAge) {
      return { valid: false, error: 'Payment proof expired' }
    }

    // Check for replay attack
    if (usedTransactions.has(proof.txHash)) {
      return { valid: false, error: 'Transaction already used' }
    }

    // Verify transaction on Stellar
    const network = options.network || proof.network || 'testnet'
    const recipient = options.recipient || AGENTMARKET_WALLET
    const server = new StellarSdk.Horizon.Server(NETWORKS[network].horizonUrl)
    const usdc = USDC[network]

    const operations = await server
      .operations()
      .forTransaction(proof.txHash)
      .call()

    for (const op of operations.records) {
      if (op.type === 'payment') {
        const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord

        if (
          paymentOp.to === recipient &&
          paymentOp.asset_code === usdc.code &&
          paymentOp.asset_issuer === usdc.issuer &&
          parseFloat(paymentOp.amount) >= expectedAmount
        ) {
          // Mark transaction as used
          usedTransactions.add(proof.txHash)

          // Clean up old transactions periodically (simple approach)
          if (usedTransactions.size > 10000) {
            const iterator = usedTransactions.values()
            for (let i = 0; i < 5000; i++) {
              usedTransactions.delete(iterator.next().value!)
            }
          }

          return {
            valid: true,
            txHash: proof.txHash,
            callerAddress: paymentOp.from,
            network,
            amount: parseFloat(paymentOp.amount),
          }
        }
      } else if (op.type === 'path_payment_strict_receive') {
        const pathOp = op as StellarSdk.Horizon.ServerApi.PathPaymentOperationRecord
        if (
          pathOp.to === recipient &&
          pathOp.asset_code === usdc.code &&
          pathOp.asset_issuer === usdc.issuer &&
          parseFloat(pathOp.amount) >= expectedAmount
        ) {
          usedTransactions.add(proof.txHash)

          if (usedTransactions.size > 10000) {
            const iterator = usedTransactions.values()
            for (let i = 0; i < 5000; i++) {
              usedTransactions.delete(iterator.next().value!)
            }
          }

          return {
            valid: true,
            txHash: proof.txHash,
            callerAddress: pathOp.from,
            network,
            amount: parseFloat(pathOp.amount),
          }
        }
      }
    }

    return { valid: false, error: 'Payment not found or insufficient amount' }
  } catch (error) {
    console.error('Payment verification error:', error)
    return { 
      valid: false, 
      error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * x402 middleware wrapper for API routes
 */
export function withX402Payment(
  apiName: string,
  apiId: string,
  priceUsdc: number,
  handler: (
    request: NextRequest,
    payment: PaymentVerificationResult
  ) => Promise<NextResponse>,
  options: X402PaymentOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check if payment proof is present
    const hasPaymentProof = request.headers.has(X402_HEADERS.PAYMENT_PROOF)
    const network = options.network || 'testnet'
    const recipient = options.recipient || AGENTMARKET_WALLET
    const memo = options.memo || `agentmarket:${apiId}`

    if (!hasPaymentProof) {
      // Return 402 Payment Required
      return paymentRequired(apiName, apiId, priceUsdc, network, recipient, memo)
    }

    // Verify the payment
    const verification = await verifyPayment(request, priceUsdc, {
      network,
      recipient,
    })

    if (!verification.valid) {
      return NextResponse.json(
        {
          error: 'Payment Verification Failed',
          message: verification.error,
        },
        { status: 402 }
      )
    }

    // Payment valid - execute the API handler
    const response = await handler(request, verification)

    // Add payment info to response headers
    response.headers.set('X-Payment-TxHash', verification.txHash || '')
    response.headers.set('X-Payment-Amount', priceUsdc.toFixed(6))

    return response
  }
}
