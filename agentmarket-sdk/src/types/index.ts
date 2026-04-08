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
  /** Maximum USDC per single API call */
  maxPerCall: number
  /** Maximum USDC per session */
  maxPerSession: number
  /** Maximum USDC per provider (optional) */
  maxPerProvider?: number
}

export interface BudgetStatus {
  totalBudget: number
  spent: number
  remaining: number
  limits: BudgetLimits
  callCount: number
}

// API Registry
export interface ApiInfo {
  id: string
  name: string
  slug: string
  description: string
  category: string
  priceUsdc: number
  endpoint: string
  method: 'GET' | 'POST'
  provider: {
    name: string
    stellarAddress: string
  }
}

export type ApiCategory = string

// x402 Payment Protocol
export interface PaymentRequired {
  statusCode: 402
  payment: PaymentDetails
}

export interface PaymentDetails {
  recipient: string
  amount: string
  currency: 'USDC'
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
export interface WeatherResponse {
  city: string
  country: string
  temp: number
  tempMin: number
  tempMax: number
  feelsLike: number
  humidity: number
  windSpeed: number
  conditions: string
  description: string
  icon: string
  sunrise: number
  sunset: number
}

export interface AirQualityResponse {
  city: string
  country: string
  aqi: number
  category: 'Good' | 'Moderate' | 'Unhealthy for Sensitive' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous'
  mainPollutant: string
  pollutants: {
    pm25: number
    pm10: number
    o3: number
    no2: number
    so2: number
    co: number
  }
  healthRecommendation: string
}

export interface NewsArticle {
  title: string
  source: string
  author?: string
  description?: string
  url: string
  imageUrl?: string
  publishedAt: string
}

export interface NewsResponse {
  articles: NewsArticle[]
  totalResults: number
  query: string
}

export interface CurrencyResponse {
  from: string
  to: string
  amount: number
  rate: number
  converted: number
  timestamp: string
}

export interface GeolocationResponse {
  ip: string
  city: string
  region: string
  country: string
  countryCode: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
}

export interface AIResponse {
  response: string
  model: string
  tokensUsed: number
  finishReason: string
}

// Event types for logging/monitoring
export interface SDKEvent {
  type: 'api_call' | 'payment_sent' | 'payment_confirmed' | 'error' | 'budget_warning'
  timestamp: Date
  data: Record<string, unknown>
}

export type EventHandler = (event: SDKEvent) => void

// Stellar types
export interface StellarBalance {
  xlm: string
  usdc: string
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
