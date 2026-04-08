// AgentMarket Configuration Constants

// Stellar Network Configuration
export const STELLAR_CONFIG = {
  TESTNET: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    explorerUrl: 'https://testnet.stellarchain.io',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  MAINNET: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    explorerUrl: 'https://stellarchain.io',
  },
} as const

// USDC Asset Configuration (Stellar Testnet)
export const USDC_ASSET = {
  code: 'USDC',
  issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', // Testnet USDC issuer
} as const

// AgentMarket Wallet (receives marketplace fees)
export const AGENTMARKET_WALLET = {
  publicKey: process.env.NEXT_PUBLIC_AGENTMARKET_WALLET || 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3VQXTWLHKMIS',
} as const

// Marketplace Fee Configuration
export const MARKETPLACE_FEES = {
  platformFeePercent: 10, // 10% platform fee on proxied APIs
  minPriceUsdc: 0.0001,
  maxPriceUsdc: 100,
} as const

// API Pricing (USDC per call)
export const API_PRICING = {
  weather: 0.001,
  'air-quality': 0.001,
  news: 0.002,
  currency: 0.001,
  geolocation: 0.001,
  'ai-inference': 0.005,
} as const

// Default Budget Limits
export const DEFAULT_BUDGET_LIMITS = {
  maxPerCall: 0.01,      // Max $0.01 per API call
  maxPerSession: 1.0,    // Max $1.00 per session
  maxPerProvider: 0.5,   // Max $0.50 per provider per session
} as const

// API Categories with metadata
export const CATEGORIES = [
  { id: 'WEATHER', name: 'Weather', icon: 'WX', description: 'Real-time weather data' },
  { id: 'NEWS', name: 'News', icon: 'NEWS', description: 'Latest headlines and articles' },
  { id: 'FINANCE', name: 'Finance', icon: 'FIN', description: 'Currency, stocks, crypto' },
  { id: 'GEO', name: 'Geolocation', icon: 'GEO', description: 'Location and mapping data' },
  { id: 'AI', name: 'AI', icon: 'AI', description: 'Machine learning inference' },
  { id: 'DATA', name: 'Data', icon: 'DATA', description: 'General data services' },
  { id: 'UTILITIES', name: 'Utilities', icon: 'UTIL', description: 'Helper services' },
] as const

// x402 Protocol Configuration
export const X402_CONFIG = {
  headerName: 'X-Payment-Proof',
  statusCode: 402,
  maxPaymentAge: 60 * 5, // 5 minutes max age for payment proof
} as const

// Demo Configuration
export const DEMO_CONFIG = {
  pollutedCities: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bangalore'],
  taskDescription: 'Research air quality, weather, and top news for the 5 most polluted Indian cities today and give me a weekend travel recommendation.',
  maxDemoTime: 30000, // 30 seconds max demo time
  streamDelay: 100, // ms between log updates
} as const

// External API Keys (loaded from env)
export const EXTERNAL_APIS = {
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    apiKey: process.env.OPENWEATHERMAP_API_KEY,
  },
  airVisual: {
    baseUrl: 'https://api.airvisual.com/v2',
    apiKey: process.env.AIRVISUAL_API_KEY,
  },
  newsApi: {
    baseUrl: 'https://newsapi.org/v2',
    apiKey: process.env.NEWSAPI_API_KEY,
  },
  exchangeRate: {
    baseUrl: 'https://api.exchangerate-api.com/v4',
    apiKey: process.env.EXCHANGERATE_API_KEY,
  },
  ipInfo: {
    baseUrl: 'https://ipinfo.io',
    apiKey: process.env.IPINFO_API_KEY,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  },
} as const

// Rate Limiting
export const RATE_LIMITS = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  burstLimit: 10,
} as const
