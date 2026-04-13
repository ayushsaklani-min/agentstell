/**
 * Stellar Client for AgentMarket SDK
 * Handles all Stellar blockchain interactions — native XLM payments only
 */

import * as StellarSdk from '@stellar/stellar-sdk'
import type { NetworkType, StellarBalance, TransactionResult } from '../types'

// Network configurations
const NETWORKS = {
  testnet: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  mainnet: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    friendbotUrl: '', // Not available on mainnet
  },
} as const

// Network config type
type NetworkConfig = {
  networkPassphrase: string
  horizonUrl: string
  friendbotUrl: string
}

/**
 * Extract structured error detail from Horizon transaction failures.
 * Horizon responses include result_codes (e.g. "op_underfunded", "op_no_trust")
 * which are far more actionable than the generic error message.
 */
function extractHorizonError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } }; title?: string } } }).response
    const extras = resp?.data?.extras
    if (extras?.result_codes) {
      const codes = extras.result_codes
      const parts: string[] = []
      if (codes.transaction) parts.push(`tx: ${codes.transaction}`)
      if (codes.operations?.length) parts.push(`ops: [${codes.operations.join(', ')}]`)
      if (parts.length > 0) {
        const title = resp?.data?.title || 'Transaction failed'
        return `${title} — ${parts.join(', ')}`
      }
    }
    if (resp?.data?.extras) {
      const title = resp.data.title || 'Transaction failed'
      return title
    }
  }
  return error instanceof Error ? error.message : 'Payment failed'
}

export class StellarClient {
  private network: NetworkType
  private server: StellarSdk.Horizon.Server
  private keypair: StellarSdk.Keypair | null = null
  private config: NetworkConfig

  constructor(network: NetworkType = 'mainnet', secretKey?: string) {
    this.network = network
    this.config = NETWORKS[network]
    this.server = new StellarSdk.Horizon.Server(this.config.horizonUrl)

    if (secretKey) {
      this.keypair = StellarSdk.Keypair.fromSecret(secretKey)
    }
  }

  /** Get public key */
  get publicKey(): string | null {
    return this.keypair?.publicKey() ?? null
  }

  /** Get account balances */
  async getBalance(publicKey?: string): Promise<StellarBalance> {
    const address = publicKey ?? this.publicKey
    if (!address) {
      throw new Error('No public key provided')
    }

    try {
      const account = await this.server.loadAccount(address)
      let xlm = '0'

      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlm = balance.balance
        }
      }

      return { xlm }
    } catch (error) {
      if (error instanceof StellarSdk.NotFoundError) {
        return { xlm: '0' }
      }
      throw error
    }
  }

  /** Send native XLM payment */
  async sendPayment(
    destination: string,
    amount: string,
    memo?: string
  ): Promise<TransactionResult> {
    if (!this.keypair) {
      throw new Error('No secret key configured - cannot send payments')
    }

    try {
      const sourceAccount = await this.server.loadAccount(this.keypair.publicKey())

      const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: StellarSdk.Asset.native(),
            amount,
          })
        )
        .setTimeout(30)

      if (memo) {
        // Truncate memo to 28 chars (Stellar limit)
        transactionBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
      }

      const transaction = transactionBuilder.build()
      transaction.sign(this.keypair)

      const result = await this.server.submitTransaction(transaction)

      return {
        success: true,
        txHash: result.hash,
        ledger: result.ledger,
      }
    } catch (error) {
      return {
        success: false,
        error: extractHorizonError(error),
      }
    }
  }

  /** Verify a native XLM payment transaction */
  async verifyPayment(
    txHash: string,
    expectedRecipient: string,
    expectedAmount: string
  ): Promise<boolean> {
    try {
      const operations = await this.server
        .operations()
        .forTransaction(txHash)
        .call()

      for (const op of operations.records) {
        if (op.type === 'payment') {
          const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord

          if (
            paymentOp.to === expectedRecipient &&
            paymentOp.asset_type === 'native' &&
            parseFloat(paymentOp.amount) >= parseFloat(expectedAmount)
          ) {
            return true
          }
        }
      }

      return false
    } catch {
      return false
    }
  }

  /** Fund account on testnet via Friendbot */
  async fundTestnetAccount(publicKey?: string): Promise<boolean> {
    if (this.network !== 'testnet') {
      throw new Error('Friendbot only available on testnet')
    }

    const address = publicKey ?? this.publicKey
    if (!address) {
      throw new Error('No public key provided')
    }

    try {
      const response = await fetch(
        `${NETWORKS.testnet.friendbotUrl}?addr=${address}`
      )
      return response.ok
    } catch {
      return false
    }
  }

  /** Generate new keypair */
  static generateKeypair(): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.random()
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    }
  }

  /** Get explorer URL for a transaction */
  getExplorerUrl(txHash: string): string {
    const baseUrl = this.network === 'mainnet'
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet'
    return `${baseUrl}/tx/${txHash}`
  }
}
