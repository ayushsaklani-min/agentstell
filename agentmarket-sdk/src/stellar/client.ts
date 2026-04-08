/**
 * Stellar Client for AgentMarket SDK
 * Handles all Stellar blockchain interactions
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

// USDC Asset on Stellar (Testnet)
const USDC_TESTNET = {
  code: 'USDC',
  issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
}

// USDC Asset on Stellar (Mainnet - Circle)
const USDC_MAINNET = {
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
}

export class StellarClient {
  private network: NetworkType
  private server: StellarSdk.Horizon.Server
  private keypair: StellarSdk.Keypair | null = null
  private config: NetworkConfig

  constructor(network: NetworkType = 'testnet', secretKey?: string) {
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

  /** Get USDC asset for current network */
  get usdcAsset(): StellarSdk.Asset {
    const usdc = this.network === 'mainnet' ? USDC_MAINNET : USDC_TESTNET
    return new StellarSdk.Asset(usdc.code, usdc.issuer)
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
      let usdc = '0'

      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlm = balance.balance
        } else if (balance.asset_type === 'credit_alphanum4') {
          const usdcConfig = this.network === 'mainnet' ? USDC_MAINNET : USDC_TESTNET
          if (
            balance.asset_code === usdcConfig.code &&
            balance.asset_issuer === usdcConfig.issuer
          ) {
            usdc = balance.balance
          }
        }
      }

      return { xlm, usdc }
    } catch (error) {
      if (error instanceof StellarSdk.NotFoundError) {
        return { xlm: '0', usdc: '0' }
      }
      throw error
    }
  }

  /** Send USDC payment */
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
            asset: this.usdcAsset,
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
      const message = error instanceof Error ? error.message : 'Payment failed'
      return {
        success: false,
        error: message,
      }
    }
  }

  /** Verify a payment transaction */
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
          const usdcConfig = this.network === 'mainnet' ? USDC_MAINNET : USDC_TESTNET

          if (
            paymentOp.to === expectedRecipient &&
            paymentOp.asset_code === usdcConfig.code &&
            paymentOp.asset_issuer === usdcConfig.issuer &&
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

  /** Establish USDC trustline (required before receiving USDC) */
  async establishTrustline(): Promise<TransactionResult> {
    if (!this.keypair) {
      throw new Error('No secret key configured')
    }

    try {
      const sourceAccount = await this.server.loadAccount(this.keypair.publicKey())

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: this.usdcAsset,
          })
        )
        .setTimeout(30)
        .build()

      transaction.sign(this.keypair)
      const result = await this.server.submitTransaction(transaction)

      return {
        success: true,
        txHash: result.hash,
        ledger: result.ledger,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trustline failed'
      return {
        success: false,
        error: message,
      }
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
      ? 'https://stellarchain.io'
      : 'https://testnet.stellarchain.io'
    return `${baseUrl}/tx/${txHash}`
  }
}
