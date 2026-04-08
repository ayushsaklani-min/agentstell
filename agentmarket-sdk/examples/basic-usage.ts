/**
 * Basic Usage Example
 * 
 * This example shows how to use the AgentMarket SDK to fetch data
 * from various APIs using x402 micropayments on Stellar.
 */

import { AgentMarket } from '../src'

async function main() {
  // Initialize the SDK with your Stellar credentials
  const agent = new AgentMarket({
    // Your Stellar testnet secret key
    secretKey: process.env.STELLAR_SECRET_KEY,
    network: 'testnet',
    
    // Budget limits to prevent overspending
    budgetLimits: {
      maxPerCall: 0.01,      // Max $0.01 per API call
      maxPerSession: 1.0,    // Max $1.00 total this session
    },
    
    // Enable debug logging
    debug: true,
  })

  // Subscribe to events
  agent.on((event) => {
    if (event.type === 'payment_confirmed') {
      console.log(`Payment confirmed: ${event.data.txHash}`)
      console.log(`   Cost: $${event.data.cost} USDC`)
    }
  })

  console.log('AgentMarket SDK Example\n')

  // Check wallet balance
  const balance = await agent.getBalance()
  console.log(`Wallet Balance: ${balance.xlm} XLM, ${balance.usdc} USDC\n`)

  // Example 1: Get weather data
  console.log('Fetching weather for Mumbai...')
  const weather = await agent.weather('Mumbai')
  
  if (weather.success) {
    console.log(`   Temperature: ${weather.data?.temp}°C`)
    console.log(`   Conditions: ${weather.data?.conditions}`)
    console.log(`   Cost: $${weather.metadata.cost} USDC`)
  } else {
    console.log(`   Error: ${weather.error}`)
  }

  // Example 2: Get air quality
  console.log('\nFetching air quality for Delhi...')
  const airQuality = await agent.airQuality('Delhi')
  
  if (airQuality.success) {
    console.log(`   AQI: ${airQuality.data?.aqi}`)
    console.log(`   Category: ${airQuality.data?.category}`)
    console.log(`   Cost: $${airQuality.metadata.cost} USDC`)
  } else {
    console.log(`   Error: ${airQuality.error}`)
  }

  // Example 3: Get news headlines
  console.log('\nFetching AI news...')
  const news = await agent.news('artificial intelligence', 5)
  
  if (news.success) {
    console.log(`   Found ${news.data?.articles.length} articles:`)
    news.data?.articles.slice(0, 3).forEach((article, i) => {
      console.log(`   ${i + 1}. ${article.title.slice(0, 60)}...`)
    })
    console.log(`   Cost: $${news.metadata.cost} USDC`)
  } else {
    console.log(`   Error: ${news.error}`)
  }

  // Example 4: Currency conversion
  console.log('\nConverting 100 USD to EUR...')
  const currency = await agent.currency('USD', 'EUR', 100)
  
  if (currency.success) {
    console.log(`   Rate: 1 USD = ${currency.data?.rate} EUR`)
    console.log(`   Result: $100 = €${currency.data?.converted}`)
    console.log(`   Cost: $${currency.metadata.cost} USDC`)
  } else {
    console.log(`   Error: ${currency.error}`)
  }

  // Check final budget status
  const budget = agent.getBudgetStatus()
  console.log('\nSession Summary:')
  console.log(`   API Calls Made: ${budget.callCount}`)
  console.log(`   Total Spent: $${budget.spent.toFixed(4)} USDC`)
  console.log(`   Budget Remaining: $${budget.remaining.toFixed(4)} USDC`)
}

main().catch(console.error)
