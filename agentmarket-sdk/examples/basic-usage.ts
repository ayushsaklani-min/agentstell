/**
 * Basic Usage Example
 *
 * Shows how to use the AgentMarket SDK to call paid APIs
 * using x402 micropayments with native XLM on Stellar mainnet.
 */

import { AgentMarket } from '../src'

async function main() {
  // Initialize the SDK with your Stellar credentials
  const agent = new AgentMarket({
    secretKey: process.env.STELLAR_SECRET_KEY,
    network: 'mainnet',

    // Budget limits to prevent overspending
    budgetLimits: {
      maxPerCall: 1.0,       // Max 1 XLM per API call
      maxPerSession: 5.0,    // Max 5 XLM total this session
    },

    // Enable debug logging
    debug: true,
  })

  // Subscribe to events
  agent.on((event) => {
    if (event.type === 'payment_confirmed') {
      console.log(`Payment confirmed: ${event.data.txHash}`)
      console.log(`   Cost: ${event.data.cost} XLM`)
    }
  })

  console.log('AgentMarket SDK Example\n')

  // Check wallet balance
  const balance = await agent.getBalance()
  console.log(`Wallet Balance: ${balance.xlm} XLM\n`)

  // Example 1: Get stock analysis with sentiment
  console.log('Fetching stock analysis for NVDA...')
  const analysis = await agent.stockAnalyst('NVDA')

  if (analysis.success) {
    console.log(`   Price: $${analysis.data?.price}`)
    console.log(`   Sentiment: ${analysis.data?.sentiment}`)
    console.log(`   Reason: ${analysis.data?.reason}`)
    console.log(`   Cost: ${analysis.metadata.cost} XLM`)
  } else {
    console.log(`   Error: ${analysis.error}`)
  }

  // Example 2: Get trading recommendation
  console.log('\nFetching trading advice for TSLA...')
  const advice = await agent.tradingAdvisor('TSLA')

  if (advice.success) {
    console.log(`   Action: ${advice.data?.action}`)
    console.log(`   Confidence: ${advice.data?.confidence}%`)
    console.log(`   Entry: $${advice.data?.entryTarget}`)
    console.log(`   Stop-loss: $${advice.data?.stopLoss}`)
    console.log(`   Cost: ${advice.metadata.cost} XLM`)
  } else {
    console.log(`   Error: ${advice.error}`)
  }

  // Check final budget status
  const budget = agent.getBudgetStatus()
  console.log('\nSession Summary:')
  console.log(`   API Calls Made: ${budget.callCount}`)
  console.log(`   Total Spent: ${budget.spent.toFixed(4)} XLM`)
  console.log(`   Budget Remaining: ${budget.remaining.toFixed(4)} XLM`)
}

main().catch(console.error)
