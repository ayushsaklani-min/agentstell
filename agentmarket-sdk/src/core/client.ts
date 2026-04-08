/**
 * AgentMarket SDK - Core Client
 * The main interface for AI agents to access APIs via x402 micropayments
 */

import { StellarClient } from '../stellar/client'
import { X402Client } from '../x402/client'
import type {
  AgentMarketConfig,
  BudgetLimits,
  BudgetStatus,
  ApiInfo,
  ApiResult,
  WeatherResponse,
  AirQualityResponse,
  NewsResponse,
  CurrencyResponse,
  GeolocationResponse,
  AIResponse,
  EventHandler,
  SDKEvent,
  PreflightResult,
  ExecutionReceipt,
  CapabilitySpec,
} from '../types'

// Default configuration
const DEFAULT_CONFIG: Required<Omit<AgentMarketConfig, 'secretKey' | 'publicKey'>> = {
  network: 'testnet',
  budgetLimits: {
    maxPerCall: 0.01,
    maxPerSession: 1.0,
    maxPerProvider: 0.5,
  },
  baseUrl: 'https://agentmarket.xyz',
  debug: false,
  timeout: 30000,
}

// API Registry - built-in APIs with their prices
const API_REGISTRY: Record<string, ApiInfo> = {
  weather: {
    id: 'weather',
    name: 'Weather',
    slug: 'weather',
    description: 'Real-time weather data by city',
    category: 'weather',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/weather',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  'air-quality': {
    id: 'air-quality',
    name: 'Air Quality',
    slug: 'air-quality',
    description: 'Air quality index and pollutant levels',
    category: 'air-quality',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/air-quality',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  news: {
    id: 'news',
    name: 'News',
    slug: 'news',
    description: 'Top headlines by topic',
    category: 'news',
    priceUsdc: 0.002,
    endpoint: '/api/proxy/news',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  currency: {
    id: 'currency',
    name: 'Currency',
    slug: 'currency',
    description: 'Live currency exchange rates',
    category: 'currency',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/currency',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  geolocation: {
    id: 'geolocation',
    name: 'Geolocation',
    slug: 'geolocation',
    description: 'IP geolocation lookup',
    category: 'geolocation',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/geolocation',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  ai: {
    id: 'ai',
    name: 'AI Inference',
    slug: 'ai',
    description: 'AI model inference',
    category: 'ai',
    priceUsdc: 0.005,
    endpoint: '/api/proxy/ai',
    method: 'POST',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  'agent-test': {
    id: 'agent-test',
    name: 'Agent Test',
    slug: 'agent-test',
    description: 'Paid SDK integration test endpoint for validating x402 flows',
    category: 'utilities',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/agent-test',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
}

export class AgentMarket {
  private stellar: StellarClient
  private x402: X402Client
  private config: Required<AgentMarketConfig>
  private discoveredApis = new Map<string, ApiInfo>()
  private sessionSpent: number = 0
  private callCount: number = 0
  private eventHandlers: EventHandler[] = []

  constructor(config: AgentMarketConfig = {}) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      budgetLimits: {
        ...DEFAULT_CONFIG.budgetLimits,
        ...config.budgetLimits,
      },
    } as Required<AgentMarketConfig>

    // Initialize Stellar client
    this.stellar = new StellarClient(
      this.config.network,
      this.config.secretKey
    )

    // Initialize x402 client
    this.x402 = new X402Client({
      stellarClient: this.stellar,
      network: this.config.network,
      debug: this.config.debug,
    })

    if (this.config.debug) {
      console.log('[AgentMarket] Initialized with config:', {
        network: this.config.network,
        baseUrl: this.config.baseUrl,
        budgetLimits: this.config.budgetLimits,
        publicKey: this.stellar.publicKey,
      })
    }
  }

  /**
   * Get data from an API (main method)
   * Usage: const weather = await agent.get('weather', { city: 'Mumbai' })
   */
  async get<T = unknown>(apiName: string, params: Record<string, unknown> = {}): Promise<ApiResult<T>> {
    const startTime = Date.now()
    
    try {
      // Look up API in registry
      const api = await this.loadApiInfo(apiName)
      if (!api) {
        return this.createErrorResult(apiName, `API '${apiName}' not found`, startTime)
      }

      // Check budget
      const budgetCheck = this.checkBudget(api.priceUsdc)
      if (!budgetCheck.allowed) {
        return this.createErrorResult(apiName, budgetCheck.reason!, startTime)
      }

      // Validate params against capability spec before paying
      const paramErrors = this.validateParams(api, params)
      if (paramErrors.length > 0) {
        return this.createErrorResult(apiName, `Request validation failed: ${paramErrors.join('; ')}`, startTime)
      }

      // Build request based on the API contract.
      const request = this.buildRequest(api, params)

      this.emit({
        type: 'api_call',
        timestamp: new Date(),
        data: { apiName, params, price: api.priceUsdc },
      })

      // Execute with x402 payment
      this.emit({ type: 'payment_required', timestamp: new Date(), data: { apiName, priceUsdc: api.priceUsdc } })

      const { data, txHash, cost } = await this.x402.executeWithPayment<T>(
        request.url,
        request.options
      )

      // Update session tracking
      this.sessionSpent += cost
      this.callCount++

      // Emit lifecycle events
      if (txHash) {
        this.emit({
          type: 'payment_confirmed',
          timestamp: new Date(),
          data: {
            apiName,
            txHash,
            cost,
            explorerUrl: this.stellar.getExplorerUrl(txHash),
          },
        })

        // Record receipt
        this.receipts.push({
          slug: api.slug,
          txHash,
          network: this.config.network,
          providerAddress: api.provider.stellarAddress,
          amountUsdc: cost,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
          success: true,
        })
      }

      this.emit({ type: 'upstream_completed', timestamp: new Date(), data: { apiName, latencyMs: Date.now() - startTime } })

      // Check if approaching budget limit
      const remaining = this.config.budgetLimits.maxPerSession - this.sessionSpent
      if (remaining < this.config.budgetLimits.maxPerCall * 2) {
        this.emit({
          type: 'budget_warning',
          timestamp: new Date(),
          data: { remaining, spent: this.sessionSpent },
        })
      }

      return {
        success: true,
        data,
        metadata: {
          apiName,
          txHash: txHash || undefined,
          cost,
          latencyMs: Date.now() - startTime,
          timestamp: new Date(),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { apiName, error: message },
      })

      return this.createErrorResult(apiName, message, startTime)
    }
  }

  // ============ Typed API Methods ============

  /** Get weather data for a city */
  async weather(city: string): Promise<ApiResult<WeatherResponse>> {
    return this.get<WeatherResponse>('weather', { city })
  }

  /** Get air quality data for a city */
  async airQuality(city: string): Promise<ApiResult<AirQualityResponse>> {
    return this.get<AirQualityResponse>('air-quality', { city })
  }

  /** Get news articles by topic */
  async news(topic: string, limit: number = 10): Promise<ApiResult<NewsResponse>> {
    return this.get<NewsResponse>('news', { topic, limit })
  }

  /** Convert currency */
  async currency(from: string, to: string, amount: number = 1): Promise<ApiResult<CurrencyResponse>> {
    return this.get<CurrencyResponse>('currency', { from, to, amount })
  }

  /** Get geolocation for an IP address */
  async geolocation(ip: string): Promise<ApiResult<GeolocationResponse>> {
    return this.get<GeolocationResponse>('geolocation', { ip })
  }

  /** Get AI inference response */
  async ai(prompt: string, model?: string): Promise<ApiResult<AIResponse>> {
    return this.get<AIResponse>('ai', { prompt, model })
  }

  // ============ Budget Management ============

  /** Get current budget status */
  getBudgetStatus(): BudgetStatus {
    return {
      totalBudget: this.config.budgetLimits.maxPerSession,
      spent: this.sessionSpent,
      remaining: this.config.budgetLimits.maxPerSession - this.sessionSpent,
      limits: this.config.budgetLimits,
      callCount: this.callCount,
    }
  }

  /** Update budget limits */
  setBudgetLimits(limits: Partial<BudgetLimits>): void {
    this.config.budgetLimits = {
      ...this.config.budgetLimits,
      ...limits,
    }
  }

  /** Reset session spending (start fresh) */
  resetSession(): void {
    this.sessionSpent = 0
    this.callCount = 0
    this.receipts = []
  }

  // ============ Wallet Management ============

  /** Get wallet balances */
  async getBalance(): Promise<{ xlm: string; usdc: string }> {
    return this.stellar.getBalance()
  }

  /** Get wallet public key */
  getPublicKey(): string | null {
    return this.stellar.publicKey
  }

  /** Get explorer URL for a transaction */
  getExplorerUrl(txHash: string): string {
    return this.stellar.getExplorerUrl(txHash)
  }

  // ============ API Registry ============

  /** List all available APIs */
  listApis(): ApiInfo[] {
    return [
      ...Object.values(API_REGISTRY),
      ...Array.from(this.discoveredApis.values()).filter(
        (api) => !API_REGISTRY[api.slug.toLowerCase()]
      ),
    ]
  }

  /** Get info for a specific API */
  getApiInfo(apiName: string): ApiInfo | undefined {
    return API_REGISTRY[apiName.toLowerCase()] || this.discoveredApis.get(apiName.toLowerCase())
  }

  /** Get API price */
  getApiPrice(apiName: string): number | undefined {
    return this.getApiInfo(apiName)?.priceUsdc
  }

  /** Discover APIs from the live marketplace */
  async discoverApis(forceRefresh: boolean = false): Promise<ApiInfo[]> {
    if (!forceRefresh && this.discoveredApis.size > 0) {
      return this.listApis()
    }

    const response = await fetch(new URL('/api/marketplace', this.config.baseUrl), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to load marketplace: ${response.status} ${response.statusText}`)
    }

    const body = await response.json() as { apis?: unknown[] }
    const apis = Array.isArray(body.apis) ? body.apis.map((api) => this.mapMarketplaceApi(api)) : []

    for (const api of apis) {
      this.discoveredApis.set(api.slug.toLowerCase(), api)
    }

    return this.listApis()
  }

  /** Invoke a marketplace API by slug. */
  async invoke<T = unknown>(apiName: string, params: Record<string, unknown> = {}): Promise<ApiResult<T>> {
    return this.get<T>(apiName, params)
  }

  // ============ Preflight ============

  /**
   * Inspect an API before paying — returns cost, capability spec, budget check, provider info.
   * Agents should call this before committing real money.
   */
  async preflight(apiName: string): Promise<PreflightResult> {
    const api = await this.loadApiInfo(apiName)
    if (!api) {
      throw new Error(`API '${apiName}' not found in registry or marketplace`)
    }

    const budgetCheck = this.checkBudget(api.priceUsdc)
    const spec = api.capabilitySpec ?? null

    const result: PreflightResult = {
      slug: api.slug,
      name: api.name,
      method: api.method,
      endpoint: api.endpoint,
      priceUsdc: api.priceUsdc,
      provider: api.provider,
      budgetAllowed: budgetCheck.allowed,
      budgetReason: budgetCheck.reason,
      capabilitySpec: spec,
      estimatedLatency: spec?.latencyHint ?? 'fast',
      sideEffects: spec?.sideEffectLevel ?? 'read',
      idempotent: spec?.idempotent ?? true,
    }

    this.emit({
      type: 'preflight',
      timestamp: new Date(),
      data: { slug: api.slug, priceUsdc: api.priceUsdc, budgetAllowed: budgetCheck.allowed },
    })

    return result
  }

  // ============ Receipts ============

  private receipts: ExecutionReceipt[] = []

  /** Get all execution receipts from this session */
  getReceipts(): ExecutionReceipt[] {
    return [...this.receipts]
  }

  /** Get receipt for a specific transaction hash */
  getReceipt(txHash: string): ExecutionReceipt | undefined {
    return this.receipts.find((r) => r.txHash === txHash)
  }

  // ============ Event Handling ============

  /** Subscribe to SDK events */
  on(handler: EventHandler): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler)
    }
  }

  private emit(event: SDKEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('[AgentMarket] Event handler error:', e)
      }
    }
  }

  // ============ Private Helpers ============

  /**
   * Validate caller-supplied params against the API's capability spec.
   * Returns an array of human-readable error strings (empty = valid).
   */
  private validateParams(api: ApiInfo, params: Record<string, unknown>): string[] {
    const spec = api.capabilitySpec
    if (!spec || spec.params.length === 0) return []

    const errors: string[] = []

    for (const param of spec.params) {
      const value = params[param.name]

      if (param.required && (value === undefined || value === null)) {
        errors.push(`Missing required param '${param.name}' (${param.type})`)
        continue
      }

      if (value !== undefined && value !== null) {
        const actualType = typeof value
        // Loose type check — 'number' includes int, 'string' includes any string
        if (param.type === 'number' && actualType !== 'number') {
          errors.push(`Param '${param.name}' should be a number, got ${actualType}`)
        } else if (param.type === 'string' && actualType !== 'string') {
          errors.push(`Param '${param.name}' should be a string, got ${actualType}`)
        } else if (param.type === 'boolean' && actualType !== 'boolean') {
          errors.push(`Param '${param.name}' should be a boolean, got ${actualType}`)
        }
      }
    }

    return errors
  }

  private checkBudget(price: number): { allowed: boolean; reason?: string } {
    const { maxPerCall, maxPerSession } = this.config.budgetLimits

    if (price > maxPerCall) {
      return { 
        allowed: false, 
        reason: `Price ${price} USDC exceeds max per call (${maxPerCall} USDC)` 
      }
    }

    if (this.sessionSpent + price > maxPerSession) {
      return { 
        allowed: false, 
        reason: `Would exceed session budget. Spent: ${this.sessionSpent}, Limit: ${maxPerSession}` 
      }
    }

    return { allowed: true }
  }

  private buildUrl(endpoint: string, params: Record<string, unknown>): string {
    const url = new URL(endpoint, this.config.baseUrl)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  private buildRequest(
    api: ApiInfo,
    params: Record<string, unknown>
  ): { url: string; options: RequestInit } {
    if (api.method === 'POST') {
      return {
        url: new URL(api.endpoint, this.config.baseUrl).toString(),
        options: {
          method: 'POST',
          body: JSON.stringify(params),
        },
      }
    }

    return {
      url: this.buildUrl(api.endpoint, params),
      options: {
        method: 'GET',
      },
    }
  }

  private async loadApiInfo(apiName: string): Promise<ApiInfo | undefined> {
    const normalized = apiName.toLowerCase()
    const cached = this.getApiInfo(normalized)

    if (cached) {
      return cached
    }

    try {
      const response = await fetch(
        new URL(`/api/marketplace/${normalized}`, this.config.baseUrl),
        {
          headers: {
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        return undefined
      }

      const body = await response.json() as { api?: unknown }
      if (!body.api) {
        return undefined
      }

      const api = this.mapMarketplaceApi(body.api)
      this.discoveredApis.set(api.slug.toLowerCase(), api)

      return api
    } catch {
      return undefined
    }
  }

  private mapMarketplaceApi(api: unknown): ApiInfo {
    const record = api as Record<string, unknown>
    const providerName = String(record.providerName ?? 'Unknown provider')
    const providerStellarAddress = String(record.providerStellarAddress ?? '')

    let capabilitySpec: CapabilitySpec | undefined
    const rawSpec = record.capabilitySpec as Record<string, unknown> | undefined
    if (rawSpec && typeof rawSpec === 'object') {
      capabilitySpec = {
        contentType: String(rawSpec.contentType ?? 'application/json'),
        params: Array.isArray(rawSpec.params) ? rawSpec.params as CapabilitySpec['params'] : [],
        requestSchema: (rawSpec.requestSchema as Record<string, unknown>) ?? null,
        responseSchema: (rawSpec.responseSchema as Record<string, unknown>) ?? null,
        exampleRequest: (rawSpec.exampleRequest as Record<string, unknown>) ?? {},
        exampleResponse: (rawSpec.exampleResponse as Record<string, unknown>) ?? {},
        sideEffectLevel: (['read', 'write', 'financial', 'destructive'].includes(String(rawSpec.sideEffectLevel))
          ? String(rawSpec.sideEffectLevel) : 'read') as CapabilitySpec['sideEffectLevel'],
        latencyHint: (['fast', 'medium', 'slow'].includes(String(rawSpec.latencyHint))
          ? String(rawSpec.latencyHint) : 'fast') as CapabilitySpec['latencyHint'],
        idempotent: rawSpec.idempotent !== false,
      }
    }

    return {
      id: String(record.id ?? record.slug ?? ''),
      name: String(record.name ?? record.slug ?? ''),
      slug: String(record.slug ?? record.id ?? ''),
      description: String(record.description ?? ''),
      category: String(record.category ?? 'utilities'),
      priceUsdc: Number(record.priceUsdc ?? 0),
      endpoint: String(record.endpoint ?? ''),
      method: record.method === 'POST' ? 'POST' : 'GET',
      provider: {
        name: providerName,
        stellarAddress: providerStellarAddress,
      },
      capabilitySpec,
    }
  }

  private createErrorResult<T>(apiName: string, error: string, startTime: number): ApiResult<T> {
    return {
      success: false,
      error,
      metadata: {
        apiName,
        cost: 0,
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
      },
    }
  }
}

// Named export for flexibility
export { AgentMarket as AgentMarketSDK }
