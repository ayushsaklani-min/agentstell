# agstell-sdk

> The first API SDK built for AI agents where **payment is authentication**.

No accounts. No API keys. No subscriptions. Just pay-per-call with USDC on Stellar.

## Installation

```bash
npm install agstell-sdk
```

## Quick Start

```typescript
import { AgentMarket } from 'agstell-sdk'

// Initialize with your Stellar wallet
const agent = new AgentMarket({
  secretKey: 'SXXXXXXX...', // Your Stellar secret key
  network: 'testnet',
  budgetLimits: {
    maxPerCall: 0.01,      // Max $0.01 per call
    maxPerSession: 1.0,    // Max $1.00 per session
  }
})

// Get weather data - automatically pays via Stellar x402
const weather = await agent.get('weather', { city: 'Mumbai' })
console.log(weather.data) // { temp: 32, conditions: 'Clear', ... }

// Get news headlines
const news = await agent.get('news', { topic: 'AI', limit: 5 })

// Get air quality
const air = await agent.get('air-quality', { city: 'Delhi' })

// Check your spending
const budget = agent.getBudgetStatus()
console.log(`Spent: $${budget.spent} / $${budget.totalBudget}`)
```

## Available APIs

| API | Description | Price/Call |
|-----|-------------|------------|
| `weather` | Real-time weather by city | $0.001 |
| `air-quality` | Air quality index & pollutants | $0.001 |
| `news` | Top headlines by topic | $0.002 |
| `currency` | Live exchange rates | $0.001 |
| `geolocation` | IP geolocation lookup | $0.001 |
| `ai` | AI model inference | $0.005 |

## Typed API Methods

For better TypeScript support, use the typed methods:

```typescript
// Weather
const weather = await agent.weather('Mumbai')
// Returns: ApiResult<WeatherResponse>

// Air Quality
const air = await agent.airQuality('Delhi')
// Returns: ApiResult<AirQualityResponse>

// News
const news = await agent.news('artificial intelligence', 10)
// Returns: ApiResult<NewsResponse>

// Currency
const currency = await agent.currency('USD', 'EUR', 100)
// Returns: ApiResult<CurrencyResponse>

// Geolocation
const geo = await agent.geolocation('8.8.8.8')
// Returns: ApiResult<GeolocationResponse>

// AI Inference
const ai = await agent.ai('Explain quantum computing')
// Returns: ApiResult<AIResponse>
```

## Budget Management

The SDK enforces spending limits to prevent runaway costs:

```typescript
const agent = new AgentMarket({
  secretKey: '...',
  budgetLimits: {
    maxPerCall: 0.01,      // Reject calls > $0.01
    maxPerSession: 1.0,    // Stop at $1.00 total
    maxPerProvider: 0.5,   // Max $0.50 to any single provider
  }
})

// Check budget status
const status = agent.getBudgetStatus()
console.log(status)
// {
//   totalBudget: 1.0,
//   spent: 0.023,
//   remaining: 0.977,
//   callCount: 5,
//   limits: { ... }
// }

// Update limits dynamically
agent.setBudgetLimits({ maxPerSession: 2.0 })

// Reset session (start fresh)
agent.resetSession()
```

## Event Handling

Subscribe to SDK events for logging and monitoring:

```typescript
agent.on((event) => {
  switch (event.type) {
    case 'api_call':
      console.log(`Calling ${event.data.apiName}...`)
      break
    case 'payment_confirmed':
      console.log(`Paid $${event.data.cost} - TX: ${event.data.txHash}`)
      break
    case 'budget_warning':
      console.log(`Warning: Only $${event.data.remaining} left`)
      break
    case 'error':
      console.error(`Error: ${event.data.error}`)
      break
  }
})
```

## Wallet Management

```typescript
// Get wallet balances
const balance = await agent.getBalance()
console.log(`XLM: ${balance.xlm}, USDC: ${balance.usdc}`)

// Get public key
const pubKey = agent.getPublicKey()

// Get explorer URL for a transaction
const url = agent.getExplorerUrl(txHash)
```

## How It Works

1. **Agent calls API** → SDK looks up the price
2. **Budget check** → Ensures spending limits aren't exceeded
3. **x402 flow** → Initial request returns HTTP 402 with payment details
4. **Stellar payment** → SDK pays exact amount in USDC
5. **Retry with proof** → Request retried with payment proof
6. **Data returned** → Fresh data delivered to your agent

All of this happens automatically in a single `agent.get()` call.

## Configuration

```typescript
interface AgentMarketConfig {
  // Stellar secret key (required for payments)
  secretKey?: string
  
  // Network: 'testnet' or 'mainnet'
  network?: 'testnet' | 'mainnet'
  
  // Budget limits
  budgetLimits?: {
    maxPerCall: number
    maxPerSession: number
    maxPerProvider?: number
  }
  
  // AgentMarket API base URL (default: https://agentmarket.xyz)
  baseUrl?: string
  
  // Enable debug logging
  debug?: boolean
  
  // Request timeout in ms (default: 30000)
  timeout?: number
}
```

## Error Handling

```typescript
const result = await agent.get('weather', { city: 'Mumbai' })

if (!result.success) {
  console.error(result.error)
  // Possible errors:
  // - "API 'xxx' not found"
  // - "Price exceeds max per call"
  // - "Would exceed session budget"
  // - "Payment failed: ..."
  // - "API error: ..."
}
```

## For AI Agents

The SDK is designed for autonomous AI agents that need to access data without human intervention:

```typescript
// Example: Research agent gathering data
async function researchCities(cities: string[]) {
  const agent = new AgentMarket({
    secretKey: process.env.STELLAR_SECRET_KEY,
    budgetLimits: { maxPerSession: 0.5 } // $0.50 max
  })

  const results = []
  
  for (const city of cities) {
    const [weather, air] = await Promise.all([
      agent.weather(city),
      agent.airQuality(city)
    ])
    
    results.push({
      city,
      weather: weather.data,
      airQuality: air.data
    })
  }

  console.log(`Research complete! Cost: $${agent.getBudgetStatus().spent}`)
  return results
}
```

## Why Stellar?

- **3-5 second finality** - Agents can't wait
- **Sub-cent fees** - $0.001 API calls are viable
- **Native USDC** - No wrapping or bridging
- **99.99% uptime** - Agents operate 24/7

## License

MIT
