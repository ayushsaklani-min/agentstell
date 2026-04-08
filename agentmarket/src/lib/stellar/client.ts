// Stellar SDK Integration for AgentMarket
import * as StellarSdk from '@stellar/stellar-sdk'
import { STELLAR_CONFIG, USDC_ASSET } from '@/config/constants'

export type NetworkType = 'testnet' | 'mainnet'

// Get network configuration
export function getNetworkConfig(network: NetworkType = 'testnet') {
  return network === 'mainnet' ? STELLAR_CONFIG.MAINNET : STELLAR_CONFIG.TESTNET
}

// Create Horizon server instance
export function createHorizonServer(network: NetworkType = 'testnet') {
  const config = getNetworkConfig(network)
  return new StellarSdk.Horizon.Server(config.horizonUrl)
}

// Create Soroban RPC client
export function createSorobanClient(network: NetworkType = 'testnet') {
  const config = getNetworkConfig(network)
  return new StellarSdk.SorobanRpc.Server(config.sorobanRpcUrl)
}

// Create USDC asset object
export function getUsdcAsset() {
  return new StellarSdk.Asset(USDC_ASSET.code, USDC_ASSET.issuer)
}

// Generate new keypair for testing
export function generateKeypair() {
  const keypair = StellarSdk.Keypair.random()
  return {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
  }
}

// Fund account on testnet via Friendbot
export async function fundTestnetAccount(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${STELLAR_CONFIG.TESTNET.friendbotUrl}?addr=${publicKey}`
    )
    return response.ok
  } catch (error) {
    console.error('Failed to fund testnet account:', error)
    return false
  }
}

// Get account balance
export async function getAccountBalance(
  publicKey: string, 
  network: NetworkType = 'testnet'
): Promise<{ xlm: string; usdc: string }> {
  try {
    const server = createHorizonServer(network)
    const account = await server.loadAccount(publicKey)
    
    let xlm = '0'
    let usdc = '0'
    
    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = balance.balance
      } else if (
        balance.asset_type === 'credit_alphanum4' &&
        balance.asset_code === USDC_ASSET.code &&
        balance.asset_issuer === USDC_ASSET.issuer
      ) {
        usdc = balance.balance
      }
    }
    
    return { xlm, usdc }
  } catch (error) {
    console.error('Failed to get account balance:', error)
    return { xlm: '0', usdc: '0' }
  }
}

// Create USDC payment transaction
export async function createUsdcPayment(
  sourceSecret: string,
  destination: string,
  amount: string,
  memo?: string,
  network: NetworkType = 'testnet'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const config = getNetworkConfig(network)
    const server = createHorizonServer(network)
    
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret)
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey())
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination,
          asset: getUsdcAsset(),
          amount,
        })
      )
      .setTimeout(30)
    
    if (memo) {
      transaction.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    }
    
    const builtTx = transaction.build()
    builtTx.sign(sourceKeypair)
    
    const result = await server.submitTransaction(builtTx)
    
    return {
      success: true,
      txHash: result.hash,
    }
  } catch (error) {
    console.error('USDC payment failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    }
  }
}

// Verify a payment transaction
export async function verifyPayment(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: string,
  network: NetworkType = 'testnet'
): Promise<{ valid: boolean; error?: string }> {
  try {
    const server = createHorizonServer(network)
    await server.transactions().transaction(txHash).call()
    
    // Get operations
    const operations = await server
      .operations()
      .forTransaction(txHash)
      .call()
    
    for (const op of operations.records) {
      if (op.type === 'payment') {
        const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord
        
        if (
          paymentOp.to === expectedRecipient &&
          paymentOp.asset_code === USDC_ASSET.code &&
          paymentOp.asset_issuer === USDC_ASSET.issuer &&
          parseFloat(paymentOp.amount) >= parseFloat(expectedAmount)
        ) {
          return { valid: true }
        }
      }
    }
    
    return { valid: false, error: 'Payment details do not match' }
  } catch (error) {
    console.error('Payment verification failed:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}

// Get Stellar Explorer URL for a transaction
export function getExplorerUrl(txHash: string, network: NetworkType = 'testnet'): string {
  const config = getNetworkConfig(network)
  return `${config.explorerUrl}/tx/${txHash}`
}

// Establish trustline for USDC
export async function establishUsdcTrustline(
  sourceSecret: string,
  network: NetworkType = 'testnet'
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getNetworkConfig(network)
    const server = createHorizonServer(network)
    
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret)
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey())
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: getUsdcAsset(),
        })
      )
      .setTimeout(30)
      .build()
    
    transaction.sign(sourceKeypair)
    
    await server.submitTransaction(transaction)
    
    return { success: true }
  } catch (error) {
    console.error('Failed to establish USDC trustline:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Trustline failed',
    }
  }
}
