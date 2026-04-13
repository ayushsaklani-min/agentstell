/**
 * AgentMarket SDK Type Definitions
 */

// Network configuration
export type NetworkType = 'testnet' | 'mainnet'

// SDK Configuration
export interface AgentMarketConfig {
  /** Stellar secret key for signing transactions */
  secretKey?: string
  /** Stellar public key (read-only mode if no secret) */
  publicKey?: string
  /** Network to use */
  network?: NetworkType
  /** Budget limits for spending control */
  budgetLimits?: BudgetLimits
  /** Base URL for AgentMarket API */
  baseUrl?: string
  /** Enable debug logging */
  debug?: boolean
  /** Request timeout in milliseconds */
  timeout?: number
}

// Budget control
export interface BudgetLimits {
  /** Maximum XLM per single API call */
  maxPerCall: number
  /** Maximum XLM per session */
  maxPerSession: number
  /** Maximum XLM per provider (optional) */
  maxPerProvider?: number
}

export interface BudgetStatus {
  totalBudget: number
  spent: number
  remaining: number
  limits: BudgetLimits
  callCount: number
}

// Capability spec — machine-readable contract for agents
export type SideEffectLevel = 'read' | 'write' | 'financial' | 'destructive'
export type LatencyHint = 'fast' | 'medium' | 'slow'

export interface ParamSpec {
  name: string
  type: string
  required: boolean
  description: string
}

export interface CapabilitySpec {
  contentType: string
  params: ParamSpec[]
  requestSchema: Record<string, unknown> | null
  responseSchema: Record<string, unknown> | null
  exampleRequest: Record<string, unknown>
  exampleResponse: Record<string, unknown>
  sideEffectLevel: SideEffectLevel
  latencyHint: LatencyHint
  idempotent: boolean
}

// API Registry
export interface ApiInfo {
  id: string
  name: string
  slug: string
  description: string
  category: string
  priceXlm: number
  endpoint: string
  method: 'GET' | 'POST'
  provider: {
    name: string
    stellarAddress: string
  }
  capabilitySpec?: CapabilitySpec
}

export type ApiCategory = string

// Preflight result — what the agent sees before paying
export interface PreflightResult {
  slug: string
  name: string
  method: 'GET' | 'POST'
  endpoint: string
  priceXlm: number
  provider: { name: string; stellarAddress: string }
  budgetAllowed: boolean
  budgetReason?: string
  capabilitySpec: CapabilitySpec | null
  estimatedLatency: LatencyHint
  sideEffects: SideEffectLevel
  idempotent: boolean
}

// Canonical receipt — proof of a paid execution
export interface ExecutionReceipt {
  slug: string
  txHash: string
  network: NetworkType
  providerAddress: string
  amountXlm: number
  timestamp: Date
  latencyMs: number
  success: boolean
  error?: string
}

// x402 Payment Protocol
export interface PaymentRequired {
  statusCode: 402
  payment: PaymentDetails
}

export interface PaymentDetails {
  recipient: string
  amount: string
  currency: 'XLM'
  memo: string
  network: NetworkType
  apiId: string
  apiName: string
  expiresAt: number
}

export interface PaymentProof {
  txHash: string
  network: NetworkType
  timestamp: number
}

// API Call Results
export interface ApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata: {
    apiName: string
    txHash?: string
    cost: number
    latencyMs: number
    timestamp: Date
  }
}

// Specific API Response Types
export interface StockAnalystResponse {
  symbol: string
  price: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
  reason: string
}

export interface TradingAdvisorResponse {
  symbol: string
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number
  entryTarget: number
  exitTarget: number
  stopLoss: number
  risk: string
  reason: string
}

// Event types for logging/monitoring — full lifecycle
export type SDKEventType =
  | 'preflight'
  | 'api_call'
  | 'payment_required'
  | 'payment_submitted'
  | 'payment_confirmed'
  | 'payment_proof_sent'
  | 'retry_started'
  | 'upstream_completed'
  | 'payment_sent'
  | 'error'
  | 'budget_warning'

export interface SDKEvent {
  type: SDKEventType
  timestamp: Date
  data: Record<string, unknown>
}

export type EventHandler = (event: SDKEvent) => void

// Stellar types
export interface StellarBalance {
  xlm: string
}

export interface TransactionResult {
  success: boolean
  txHash?: string
  error?: string
  ledger?: number
}

// Error types
export class AgentMarketError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AgentMarketError'
  }
}

export type ErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'BUDGET_EXCEEDED'
  | 'PAYMENT_FAILED'
  | 'API_NOT_FOUND'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_CONFIG'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
