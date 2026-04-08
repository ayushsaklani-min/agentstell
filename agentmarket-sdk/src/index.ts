/**
 * AgentMarket SDK
 * 
 * The first API SDK built for AI agents where payment is authentication.
 * Uses x402 micropayments on Stellar - no accounts, no API keys, no subscriptions.
 * 
 * @example
 * ```typescript
 * import { AgentMarket } from 'agstell-sdk'
 * 
 * const agent = new AgentMarket({
 *   secretKey: 'SXXXXXXX...', // Your Stellar secret key
 *   network: 'testnet',
 *   budgetLimits: {
 *     maxPerCall: 0.01,
 *     maxPerSession: 1.0,
 *   }
 * })
 * 
 * // Get weather data - automatically pays via Stellar
 * const weather = await agent.get('weather', { city: 'Mumbai' })
 * 
 * // Get news headlines
 * const news = await agent.get('news', { topic: 'AI', limit: 5 })
 * 
 * // Check budget status
 * const budget = agent.getBudgetStatus()
 * console.log(`Spent: $${budget.spent} / $${budget.totalBudget}`)
 * ```
 * 
 * @packageDocumentation
 */

// Main client
export { AgentMarket, AgentMarketSDK } from './core/client'

// Stellar utilities
export { StellarClient } from './stellar/client'

// x402 protocol
export { X402Client, createPaymentRequiredResponse, X402_HEADERS } from './x402/client'

// Constants
export {
  CONTRACTS,
  NETWORKS,
  USDC_ASSETS,
  DEFAULT_API_PRICING,
  STROOPS_PER_USDC,
  usdcToStroops,
  stroopsToUsdc,
} from './constants'

// Types
export type {
  // Config
  AgentMarketConfig,
  BudgetLimits,
  BudgetStatus,
  NetworkType,

  // API
  ApiInfo,
  ApiCategory,
  ApiResult,

  // Capability spec
  CapabilitySpec,
  ParamSpec,
  SideEffectLevel,
  LatencyHint,
  PreflightResult,
  ExecutionReceipt,

  // x402
  PaymentDetails,
  PaymentProof,
  PaymentRequired,

  // Response types
  WeatherResponse,
  AirQualityResponse,
  NewsResponse,
  NewsArticle,
  CurrencyResponse,
  GeolocationResponse,
  AIResponse,

  // Stellar
  StellarBalance,
  TransactionResult,

  // Events
  SDKEvent,
  SDKEventType,
  EventHandler,

  // Errors
  ErrorCode,
} from './types'

export { AgentMarketError } from './types'
