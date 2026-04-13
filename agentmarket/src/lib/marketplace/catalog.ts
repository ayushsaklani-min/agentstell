export interface MarketplaceParam {
  name: string
  type: string
  required: boolean
  description: string
}

export type SideEffectLevel = 'read' | 'write' | 'financial' | 'destructive'
export type LatencyHint = 'fast' | 'medium' | 'slow'

export interface CapabilitySpec {
  contentType: string
  params: MarketplaceParam[]
  requestSchema: Record<string, unknown> | null
  responseSchema: Record<string, unknown> | null
  exampleRequest: Record<string, unknown>
  exampleResponse: Record<string, unknown>
  sideEffectLevel: SideEffectLevel
  latencyHint: LatencyHint
  idempotent: boolean
}

export interface MarketplaceListing {
  id: string
  slug: string
  name: string
  icon: string
  description: string
  longDescription: string
  category: string
  priceUsdc: number
  endpoint: string
  method: 'GET' | 'POST'
  providerName: string
  providerStellarAddress: string
  totalCalls: number
  successRate: number
  avgLatencyMs: number
  isActive: boolean
  isFeatured: boolean
  /** @deprecated Use capabilitySpec.params */
  params: MarketplaceParam[]
  /** @deprecated Use capabilitySpec.exampleRequest */
  exampleRequest: Record<string, unknown>
  /** @deprecated Use capabilitySpec.exampleResponse */
  exampleResponse: Record<string, unknown>
  capabilitySpec: CapabilitySpec
}

const DEFAULT_PROVIDER_ADDRESS =
  process.env.AGENTMARKET_WALLET_PUBLIC ||
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3VQXTWLHKMIS'

function buildCapabilitySpec(
  params: MarketplaceParam[],
  exampleRequest: Record<string, unknown>,
  exampleResponse: Record<string, unknown>,
  overrides: Partial<CapabilitySpec> = {}
): CapabilitySpec {
  return {
    contentType: 'application/json',
    params,
    requestSchema: null,
    responseSchema: null,
    exampleRequest,
    exampleResponse,
    sideEffectLevel: 'read',
    latencyHint: 'fast',
    idempotent: true,
    ...overrides,
  }
}

const FALLBACK_CATALOG: MarketplaceListing[] = [
  (() => {
    const params: MarketplaceParam[] = [
      { name: 'symbol', type: 'string', required: true, description: 'Stock ticker symbol, for example AAPL or TSLA.' },
    ]
    const exReq = { symbol: 'AAPL' }
    const exRes = {
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      sentiment: 'bullish',
      reason: 'Strong momentum with 2.3% gain on high volume.',
      price: 189.45,
      previousClose: 185.20,
      change: 4.25,
      changePercent: 2.29,
      volume: 78432100,
      analysisBy: 'gemini-2.5-flash-lite',
    }
    return {
      id: 'stock-analyst',
      slug: 'stock-analyst',
      name: 'Stock Analyst',
      icon: 'STK',
      description: 'AI-powered stock sentiment analysis with live market data.',
      longDescription:
        'Submit a stock ticker symbol and receive real-time price data combined with Gemini AI sentiment analysis. Returns bullish/bearish/neutral rating with a one-line reason. Ideal for trading agents that need fast, metered market intelligence.',
      category: 'Finance',
      priceUsdc: 0.1,
      endpoint: '/api/proxy/stock-analyst',
      method: 'GET' as const,
      providerName: 'AgentMarket',
      providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
      totalCalls: 0,
      successRate: 100,
      avgLatencyMs: 1200,
      isActive: true,
      isFeatured: true,
      params,
      exampleRequest: exReq,
      exampleResponse: exRes,
      capabilitySpec: buildCapabilitySpec(params, exReq, exRes, { sideEffectLevel: 'read', latencyHint: 'slow', idempotent: true }),
    }
  })(),
  (() => {
    const params: MarketplaceParam[] = [
      { name: 'symbol', type: 'string', required: true, description: 'Stock ticker symbol, for example TSLA or NVDA.' },
    ]
    const exReq = { symbol: 'TSLA' }
    const exRes = {
      symbol: 'TSLA',
      companyName: 'Tesla, Inc.',
      currentPrice: 245.32,
      changePercent: 1.87,
      recommendation: {
        action: 'BUY',
        confidence: 72,
        entryTarget: 240.41,
        exitTarget: 264.95,
        stopLoss: 233.05,
        timeHorizon: 'medium',
        riskLevel: 'MEDIUM',
        reasons: [
          'Positive momentum with 1.87% gain on rising volume',
          'Trading below 52-week high, room for upside',
          'Sector tailwinds supporting medium-term thesis',
        ],
      },
      marketContext: {
        volume: 95321400,
        fiftyTwoWeekHigh: 299.29,
        fiftyTwoWeekLow: 138.80,
      },
      analysisBy: 'gemini-2.5-flash-lite',
    }
    return {
      id: 'trading-advisor',
      slug: 'trading-advisor',
      name: 'Trading Advisor',
      icon: 'ADV',
      description: 'AI agent that delivers actionable trading recommendations with entry/exit targets and risk profile.',
      longDescription:
        'Submit a stock ticker and receive a full trading recommendation: BUY/HOLD/SELL action, confidence score, entry target, exit target, stop-loss, time horizon, risk level, and key reasoning. Powered by Gemini with live Yahoo Finance data. Designed for autonomous trading agents that need actionable signals rather than raw data.',
      category: 'Finance',
      priceUsdc: 0.5,
      endpoint: '/api/proxy/trading-advisor',
      method: 'GET' as const,
      providerName: 'AgentMarket',
      providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
      totalCalls: 0,
      successRate: 100,
      avgLatencyMs: 1800,
      isActive: true,
      isFeatured: true,
      params,
      exampleRequest: exReq,
      exampleResponse: exRes,
      capabilitySpec: buildCapabilitySpec(params, exReq, exRes, { sideEffectLevel: 'read', latencyHint: 'slow', idempotent: true }),
    }
  })(),
]

export interface MarketplaceStatsSummary {
  totalApis: number
  totalProviders: number
  totalCalls: number
  totalVolumeUsdc: number
  averagePriceUsdc: number
}

export function getFallbackCatalog() {
  return FALLBACK_CATALOG.map((listing) => ({
    ...listing,
    params: [...listing.params],
    exampleRequest: { ...listing.exampleRequest },
    exampleResponse: { ...listing.exampleResponse },
    capabilitySpec: { ...listing.capabilitySpec },
  }))
}

export function getFallbackListing(slug: string) {
  return getFallbackCatalog().find((listing) => listing.slug === slug)
}

export function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase()

  if (normalized.includes('ai')) return 'AI'
  if (normalized.includes('finance')) return 'FIN'
  if (normalized.includes('geo')) return 'GEO'
  if (normalized.includes('weather')) return 'WX'
  if (normalized.includes('news')) return 'NEWS'
  return 'API'
}

export function summarizeMarketplace(listings: MarketplaceListing[]): MarketplaceStatsSummary {
  const totalCalls = listings.reduce((sum, listing) => sum + listing.totalCalls, 0)
  const totalVolumeUsdc = listings.reduce(
    (sum, listing) => sum + listing.totalCalls * listing.priceUsdc,
    0
  )
  const totalProviders = new Set(listings.map((listing) => listing.providerName)).size
  const averagePriceUsdc =
    listings.length > 0
      ? listings.reduce((sum, listing) => sum + listing.priceUsdc, 0) / listings.length
      : 0

  return {
    totalApis: listings.length,
    totalProviders,
    totalCalls,
    totalVolumeUsdc,
    averagePriceUsdc,
  }
}

function buildGenericParams(exampleRequest: Record<string, unknown>): MarketplaceParam[] {
  return Object.entries(exampleRequest).map(([name, value]) => ({
    name,
    type: typeof value,
    required: true,
    description: `${name} request parameter.`,
  }))
}

function safeParseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}

function safeParseParams(value: string | null | undefined): MarketplaceParam[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

const VALID_SIDE_EFFECTS = new Set(['read', 'write', 'financial', 'destructive'])
const VALID_LATENCY_HINTS = new Set(['fast', 'medium', 'slow'])

export function mapDbListing(listing: {
  id: string
  slug: string
  name: string
  description: string
  longDescription: string | null
  category: string
  priceUsdc: number
  endpoint: string
  method: string
  contentType?: string
  requestSchema?: string | null
  responseSchema?: string | null
  exampleRequest?: string | null
  exampleResponse?: string | null
  params?: string | null
  sideEffectLevel?: string
  latencyHint?: string
  idempotent?: boolean
  totalCalls: number
  successRate: number
  avgLatencyMs: number
  isActive: boolean
  isFeatured: boolean
  provider: {
    name: string
    stellarAddress: string
  }
}): MarketplaceListing {
  const fallback = getFallbackListing(listing.slug)
  const publicProxyEndpoint = fallback?.endpoint ?? `/api/proxy/${listing.slug}`

  const dbExampleRequest = safeParseJson(listing.exampleRequest) ?? {}
  const dbExampleResponse = safeParseJson(listing.exampleResponse) ?? {}
  const dbParams = safeParseParams(listing.params)

  const exampleRequest = Object.keys(dbExampleRequest).length > 0
    ? dbExampleRequest
    : (fallback?.exampleRequest ?? {})
  const exampleResponse = Object.keys(dbExampleResponse).length > 0
    ? dbExampleResponse
    : (fallback?.exampleResponse ?? {})
  const params = dbParams ?? fallback?.params ?? buildGenericParams(exampleRequest)

  const sideEffect = listing.sideEffectLevel ?? 'read'
  const latency = listing.latencyHint ?? 'fast'

  const capabilitySpec: CapabilitySpec = {
    contentType: listing.contentType ?? 'application/json',
    params,
    requestSchema: safeParseJson(listing.requestSchema) ?? fallback?.capabilitySpec?.requestSchema ?? null,
    responseSchema: safeParseJson(listing.responseSchema) ?? fallback?.capabilitySpec?.responseSchema ?? null,
    exampleRequest,
    exampleResponse,
    sideEffectLevel: VALID_SIDE_EFFECTS.has(sideEffect) ? sideEffect as SideEffectLevel : 'read',
    latencyHint: VALID_LATENCY_HINTS.has(latency) ? latency as LatencyHint : 'fast',
    idempotent: listing.idempotent ?? true,
  }

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    icon: fallback?.icon ?? getCategoryIcon(listing.category),
    description: listing.description,
    longDescription: listing.longDescription ?? fallback?.longDescription ?? listing.description,
    category: fallback?.category ?? listing.category,
    priceUsdc: listing.priceUsdc,
    endpoint: publicProxyEndpoint,
    method: listing.method === 'POST' ? 'POST' : 'GET',
    providerName: listing.provider.name,
    providerStellarAddress: listing.provider.stellarAddress,
    totalCalls: listing.totalCalls,
    successRate: listing.successRate,
    avgLatencyMs: listing.avgLatencyMs,
    isActive: listing.isActive,
    isFeatured: listing.isFeatured,
    params,
    exampleRequest,
    exampleResponse,
    capabilitySpec,
  }
}
