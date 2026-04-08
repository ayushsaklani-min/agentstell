// AgentMarket Type Definitions

export type Category = 
  | 'DATA' 
  | 'FINANCE' 
  | 'GEO' 
  | 'AI' 
  | 'UTILITIES' 
  | 'NEWS' 
  | 'WEATHER'

export interface ApiListing {
  id: string
  name: string
  slug: string
  description: string
  longDescription?: string
  category: Category
  priceUsdc: number
  endpoint: string
  method: string
  requestSchema?: Record<string, unknown>
  responseSchema?: Record<string, unknown>
  exampleRequest?: Record<string, unknown>
  exampleResponse?: Record<string, unknown>
  provider: Provider
  providerId: string
  totalCalls: number
  successRate: number
  avgLatencyMs: number
  isActive: boolean
  isProxied: boolean
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Provider {
  id: string
  name: string
  stellarAddress: string
  email?: string
  description?: string
  verified: boolean
  totalEarnings: number
  createdAt: Date
  updatedAt: Date
}

export interface ApiCall {
  id: string
  apiListingId: string
  callerAddress: string
  txHash: string
  amountUsdc: number
  requestData?: Record<string, unknown>
  responseData?: Record<string, unknown>
  success: boolean
  errorMessage?: string
  latencyMs?: number
  createdAt: Date
}

export interface AgentBudget {
  id: string
  walletAddress: string
  totalBudget: number
  spentAmount: number
  remainingBudget: number
  maxPerCall?: number
  maxPerSession?: number
  contractAddress?: string
}

export interface MarketplaceStats {
  totalApis: number
  totalProviders: number
  totalCalls: number
  totalVolumeUsdc: number
}

// SDK Types
export interface SDKConfig {
  walletSecret?: string
  walletPublicKey?: string
  network: 'testnet' | 'mainnet'
  budgetLimits?: BudgetLimits
  baseUrl?: string
}

export interface BudgetLimits {
  maxPerCall: number
  maxPerSession: number
  maxPerProvider?: number
}

export interface BudgetStatus {
  totalBudget: number
  spent: number
  remaining: number
  limits: BudgetLimits
}

export interface PaymentRequired {
  error: 'Payment Required'
  payment: {
    recipient: string
    amount: string
    currency: 'USDC'
    memo: string
    network: 'testnet' | 'mainnet'
    apiId: string
    apiName: string
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  txHash?: string
  cost?: number
  latencyMs?: number
}

// Demo Types
export interface AgentLog {
  id: string
  type: 'thinking' | 'calling' | 'result' | 'analyzing' | 'recommendation' | 'error'
  message: string
  timestamp: Date
  apiName?: string
  cost?: number
}

export interface TransactionEvent {
  id: string
  txHash: string
  apiName: string
  amount: number
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: Date
  stellarExplorerUrl: string
}

// Weather API Types
export interface WeatherData {
  city: string
  temp: number
  tempMin: number
  tempMax: number
  humidity: number
  windSpeed: number
  conditions: string
  icon: string
}

// Air Quality API Types
export interface AirQualityData {
  city: string
  aqi: number
  category: string
  pollutants: {
    pm25: number
    pm10: number
    o3: number
    no2: number
  }
  healthRecommendation: string
}

// News API Types
export interface NewsArticle {
  title: string
  source: string
  url: string
  publishedAt: string
  description?: string
  imageUrl?: string
}

export interface NewsData {
  articles: NewsArticle[]
  totalResults: number
}

// Currency API Types
export interface CurrencyData {
  from: string
  to: string
  rate: number
  amount: number
  converted: number
  timestamp: string
}

// Geolocation API Types
export interface GeolocationData {
  ip: string
  city: string
  region: string
  country: string
  countryCode: string
  lat: number
  lon: number
  timezone: string
  isp: string
}

// AI Inference API Types
export interface AIInferenceData {
  response: string
  model: string
  tokensUsed: number
  finishReason: string
}
