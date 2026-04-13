/**
 * AgentMarket SDK
 *
 * The first API SDK built for AI agents where payment is authentication.
 * Uses x402 micropayments on Stellar — native XLM, no accounts, no API keys.
 *
 * @example
 * ```typescript
 * import { AgentMarket } from 'agstell-sdk'
 *
 * const agent = new AgentMarket({
 *   secretKey: 'SXXXXXXX...', // Your Stellar secret key
 *   network: 'mainnet',
 *   budgetLimits: {
 *     maxPerCall: 1.0,
 *     maxPerSession: 10.0,
 *   }
 * })
 *
 * // Get stock analysis — automatically pays 0.1 XLM via Stellar
 * const analysis = await agent.call('stock-analyst', { symbol: 'NVDA' })
 *
 * // Get trading advice — pays 0.5 XLM
 * const advice = await agent.call('trading-advisor', { symbol: 'TSLA' })
 *
 * // Check budget status
 * const budget = agent.getBudgetStatus()
 * console.log(`Spent: ${budget.spent} XLM / ${budget.totalBudget} XLM`)
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
  DEFAULT_API_PRICING,
  STROOPS_PER_XLM,
  xlmToStroops,
  stroopsToXlm,
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
  StockAnalystResponse,
  TradingAdvisorResponse,

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
