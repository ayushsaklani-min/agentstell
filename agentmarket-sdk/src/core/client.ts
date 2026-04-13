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
  StockAnalystResponse,
  TradingAdvisorResponse,
  EventHandler,
  SDKEvent,
  PreflightResult,
  ExecutionReceipt,
  CapabilitySpec,
} from '../types'

// Default configuration
const DEFAULT_CONFIG: Required<Omit<AgentMarketConfig, 'secretKey' | 'publicKey'>> = {
  network: 'mainnet',
  budgetLimits: {
    maxPerCall: 1.0,
    maxPerSession: 10.0,
    maxPerProvider: 5.0,
  },
  baseUrl: 'https://steller-web.vercel.app',
  debug: false,
  timeout: 30000,
}

// API Registry - built-in APIs with their prices (native XLM)
const API_REGISTRY: Record<string, ApiInfo> = {
  'stock-analyst': {
    id: 'stock-analyst',
    name: 'Stock Analyst',
    slug: 'stock-analyst',
    description: 'Live Yahoo Finance data + Gemini sentiment analysis',
    category: 'Finance',
    priceXlm: 0.1,
    endpoint: '/api/proxy/stock-analyst',
    method: 'GET',
    provider: { name: 'AgentMarket', stellarAddress: '' },
  },
  'trading-advisor': {
    id: 'trading-advisor',
    name: 'Trading Advisor',
    slug: 'trading-advisor',
    description: 'Two-stage Gemini reasoning → BUY/HOLD/SELL with entry, exit, stop-loss',
    category: 'Finance',
    priceXlm: 0.5,
    endpoint: '/api/proxy/trading-advisor',
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
   * Usage: const result = await agent.get('stock-analyst', { symbol: 'NVDA' })
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
      const budgetCheck = this.checkBudget(api.priceXlm)
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
        data: { apiName, params, price: api.priceXlm },
      })

      // Execute with x402 payment
      this.emit({ type: 'payment_required', timestamp: new Date(), data: { apiName, priceXlm: api.priceXlm } })

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
          amountXlm: cost,
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

  /** Get stock analysis with sentiment */
  async stockAnalyst(symbol: string): Promise<ApiResult<StockAnalystResponse>> {
    return this.get<StockAnalystResponse>('stock-analyst', { symbol })
  }

  /** Get trading recommendation */
  async tradingAdvisor(symbol: string): Promise<ApiResult<TradingAdvisorResponse>> {
    return this.get<TradingAdvisorResponse>('trading-advisor', { symbol })
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

  /** Get wallet balance */
  async getBalance(): Promise<{ xlm: string }> {
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
    return this.getApiInfo(apiName)?.priceXlm
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

  /** Shortcut: call an API by slug (alias for get) */
  async call<T = unknown>(apiName: string, params: Record<string, unknown> = {}): Promise<ApiResult<T>> {
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

    const budgetCheck = this.checkBudget(api.priceXlm)
    const spec = api.capabilitySpec ?? null

    const result: PreflightResult = {
      slug: api.slug,
      name: api.name,
      method: api.method,
      endpoint: api.endpoint,
      priceXlm: api.priceXlm,
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
      data: { slug: api.slug, priceXlm: api.priceXlm, budgetAllowed: budgetCheck.allowed },
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
        reason: `Price ${price} XLM exceeds max per call (${maxPerCall} XLM)`
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

    // Support both priceXlm and legacy priceUsdc field names from marketplace
    const price = Number(record.priceXlm ?? record.priceUsdc ?? 0)

    return {
      id: String(record.id ?? record.slug ?? ''),
      name: String(record.name ?? record.slug ?? ''),
      slug: String(record.slug ?? record.id ?? ''),
      description: String(record.description ?? ''),
      category: String(record.category ?? 'utilities'),
      priceXlm: price,
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
