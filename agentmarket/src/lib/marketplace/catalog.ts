export interface MarketplaceParam {
  name: string
  type: string
  required: boolean
  description: string
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
  params: MarketplaceParam[]
  exampleRequest: Record<string, unknown>
  exampleResponse: Record<string, unknown>
}

const DEFAULT_PROVIDER_ADDRESS =
  process.env.AGENTMARKET_WALLET_PUBLIC ||
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3VQXTWLHKMIS'

const FALLBACK_CATALOG: MarketplaceListing[] = [
  {
    id: 'agent-test',
    slug: 'agent-test',
    name: 'Agent Test API',
    icon: 'TEST',
    description: 'Paid integration test route for validating live SDK agent calls.',
    longDescription:
      'A controlled endpoint for validating the full x402 payment flow end to end. Useful for SDK smoke tests, wallet validation, and marketplace wiring checks.',
    category: 'Utilities',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/agent-test',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 120,
    successRate: 100,
    avgLatencyMs: 40,
    isActive: true,
    isFeatured: false,
    params: [
      { name: 'task', type: 'string', required: false, description: 'Short test task label.' },
      { name: 'agentId', type: 'string', required: false, description: 'Agent identifier for traceability.' },
    ],
    exampleRequest: { task: 'validate sdk payment flow', agentId: 'codex' },
    exampleResponse: {
      api: 'agent-test',
      accepted: true,
      task: 'validate sdk payment flow',
      agentId: 'codex',
    },
  },
  {
    id: 'weather',
    slug: 'weather',
    name: 'Weather API',
    icon: 'WX',
    description: 'Get current weather data for any city worldwide.',
    longDescription:
      'Access real-time weather data for over 200,000 cities worldwide. Get temperature, humidity, wind speed, conditions, and more.',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/weather',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 2400000,
    successRate: 99.9,
    avgLatencyMs: 120,
    isActive: true,
    isFeatured: true,
    params: [
      { name: 'city', type: 'string', required: true, description: 'City name, for example Mumbai or New York.' },
      { name: 'units', type: 'string', required: false, description: 'Optional temperature units. Defaults to metric.' },
    ],
    exampleRequest: { city: 'Mumbai' },
    exampleResponse: {
      city: 'Mumbai',
      country: 'IN',
      temp: 32,
      humidity: 78,
      conditions: 'Cloudy',
    },
  },
  {
    id: 'news',
    slug: 'news',
    name: 'News API',
    icon: 'NEWS',
    description: 'Fetch latest news headlines by topic.',
    longDescription:
      'Get breaking headlines from global sources, filtered by topic and limit. Useful for research agents that need fresh context.',
    category: 'Data',
    priceUsdc: 0.002,
    endpoint: '/api/proxy/news',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 1800000,
    successRate: 99.8,
    avgLatencyMs: 200,
    isActive: true,
    isFeatured: true,
    params: [
      { name: 'topic', type: 'string', required: true, description: 'Topic to search for, for example stellar or AI.' },
      { name: 'limit', type: 'number', required: false, description: 'Number of headlines to return. Defaults to 10.' },
    ],
    exampleRequest: { topic: 'stellar', limit: 3 },
    exampleResponse: {
      articles: [
        { title: 'Stellar adoption grows', source: 'TechCrunch' },
      ],
      totalResults: 1,
      query: 'stellar',
    },
  },
  {
    id: 'ai',
    slug: 'ai',
    name: 'AI Inference',
    icon: 'AI',
    description: 'Run AI inference queries through a pay-per-call endpoint.',
    longDescription:
      'Access AI model inference with a single x402 flow. Useful for agents that need lightweight, metered reasoning without subscriptions.',
    category: 'AI',
    priceUsdc: 0.005,
    endpoint: '/api/proxy/ai',
    method: 'POST',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 890000,
    successRate: 99.5,
    avgLatencyMs: 800,
    isActive: true,
    isFeatured: true,
    params: [
      { name: 'prompt', type: 'string', required: true, description: 'Prompt sent to the model.' },
      { name: 'model', type: 'string', required: false, description: 'Optional model override.' },
    ],
    exampleRequest: { prompt: 'Explain x402 in one paragraph.' },
    exampleResponse: {
      response: 'x402 extends HTTP 402 into a machine-payable API pattern.',
      model: 'gpt-4.1',
      tokensUsed: 42,
    },
  },
  {
    id: 'currency',
    slug: 'currency',
    name: 'Currency Exchange',
    icon: 'FX',
    description: 'Convert between currencies with live rates.',
    longDescription:
      'Fetch current FX rates and convert exact amounts. Useful for fintech agents and pricing workflows.',
    category: 'Finance',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/currency',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 3100000,
    successRate: 99.9,
    avgLatencyMs: 80,
    isActive: true,
    isFeatured: false,
    params: [
      { name: 'from', type: 'string', required: true, description: 'Base currency code.' },
      { name: 'to', type: 'string', required: true, description: 'Target currency code.' },
      { name: 'amount', type: 'number', required: false, description: 'Amount to convert. Defaults to 1.' },
    ],
    exampleRequest: { from: 'USD', to: 'INR', amount: 100 },
    exampleResponse: {
      from: 'USD',
      to: 'INR',
      amount: 100,
      rate: 83.12,
      converted: 8312,
    },
  },
  {
    id: 'geolocation',
    slug: 'geolocation',
    name: 'Geolocation API',
    icon: 'GEO',
    description: 'Resolve IP addresses into location metadata.',
    longDescription:
      'Convert IP addresses into city, country, timezone, and network metadata for personalization or security workflows.',
    category: 'Geo',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/geolocation',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 1200000,
    successRate: 99.9,
    avgLatencyMs: 50,
    isActive: true,
    isFeatured: false,
    params: [
      { name: 'ip', type: 'string', required: false, description: 'IP address to look up. Defaults to requester IP.' },
    ],
    exampleRequest: { ip: '8.8.8.8' },
    exampleResponse: {
      ip: '8.8.8.8',
      city: 'Mountain View',
      country: 'US',
      timezone: 'America/Los_Angeles',
    },
  },
  {
    id: 'air-quality',
    slug: 'air-quality',
    name: 'Air Quality API',
    icon: 'AQ',
    description: 'Get real-time AQI and pollution metrics.',
    longDescription:
      'Retrieve current air quality, AQI category, and basic pollutant breakdown for city-level environmental analysis.',
    category: 'Data',
    priceUsdc: 0.001,
    endpoint: '/api/proxy/air-quality',
    method: 'GET',
    providerName: 'AgentMarket',
    providerStellarAddress: DEFAULT_PROVIDER_ADDRESS,
    totalCalls: 670000,
    successRate: 99.7,
    avgLatencyMs: 150,
    isActive: true,
    isFeatured: false,
    params: [
      { name: 'city', type: 'string', required: true, description: 'City name.' },
    ],
    exampleRequest: { city: 'Delhi' },
    exampleResponse: {
      city: 'Delhi',
      aqi: 156,
      category: 'Unhealthy',
      mainPollutant: 'pm25',
    },
  },
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
  const exampleRequest = fallback?.exampleRequest ?? {}

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    icon: fallback?.icon ?? getCategoryIcon(listing.category),
    description: listing.description,
    longDescription: listing.longDescription ?? fallback?.longDescription ?? listing.description,
    category: fallback?.category ?? listing.category,
    priceUsdc: listing.priceUsdc,
    endpoint: listing.endpoint,
    method: listing.method === 'POST' ? 'POST' : 'GET',
    providerName: listing.provider.name,
    providerStellarAddress: listing.provider.stellarAddress,
    totalCalls: listing.totalCalls,
    successRate: listing.successRate,
    avgLatencyMs: listing.avgLatencyMs,
    isActive: listing.isActive,
    isFeatured: listing.isFeatured,
    params: fallback?.params ?? buildGenericParams(exampleRequest),
    exampleRequest,
    exampleResponse: fallback?.exampleResponse ?? {},
  }
}
