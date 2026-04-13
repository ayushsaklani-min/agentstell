/**
 * AI Agent Research Example
 *
 * Demonstrates how an autonomous AI agent uses AgentMarket SDK
 * to research stocks by composing multiple paid API calls.
 * Shows A2A composition: Trading Advisor internally calls Stock Analyst.
 */

import { AgentMarket, type ApiResult } from '../src'

class ResearchAgent {
  private sdk: AgentMarket
  private logs: string[] = []

  constructor(secretKey: string) {
    this.sdk = new AgentMarket({
      secretKey,
      network: 'mainnet',
      budgetLimits: {
        maxPerCall: 1.0,
        maxPerSession: 5.0, // 5 XLM max for this research task
      },
      debug: false,
    })

    this.sdk.on((event) => {
      if (event.type === 'payment_confirmed') {
        this.log(`Paid ${event.data.cost} XLM for ${event.data.apiName}`)
      }
    })
  }

  private log(message: string) {
    const timestamp = new Date().toISOString().slice(11, 19)
    const entry = `[${timestamp}] ${message}`
    this.logs.push(entry)
    console.log(entry)
  }

  async research(symbols: string[]): Promise<{
    recommendation: string
    cost: number
  }> {
    this.log(`Researching ${symbols.length} stocks...`)

    const results: Record<string, { sentiment?: string; action?: string; confidence?: number }> = {}

    for (const symbol of symbols) {
      this.log(`Analyzing ${symbol}...`)

      // Get sentiment (0.1 XLM)
      const analysis = await this.sdk.stockAnalyst(symbol)
      if (analysis.success && analysis.data) {
        results[symbol] = { sentiment: analysis.data.sentiment }
        this.log(`   ${symbol}: ${analysis.data.sentiment} ($${analysis.data.price})`)
      }

      // Get trading advice (0.5 XLM — internally calls stock-analyst too)
      const advice = await this.sdk.tradingAdvisor(symbol)
      if (advice.success && advice.data) {
        results[symbol] = {
          ...results[symbol],
          action: advice.data.action,
          confidence: advice.data.confidence,
        }
        this.log(`   ${symbol}: ${advice.data.action} (${advice.data.confidence}% confidence)`)
      }
    }

    const budget = this.sdk.getBudgetStatus()

    const recommendation = `
AUTONOMOUS STOCK RESEARCH

Analyzed ${symbols.length} stocks using ${budget.callCount} paid API calls:

${Object.entries(results).map(([symbol, data]) =>
  `  ${symbol}: ${data.sentiment ?? '?'} → ${data.action ?? '?'} (${data.confidence ?? '?'}% confidence)`
).join('\n')}

Research Cost: ${budget.spent.toFixed(4)} XLM
API Calls: ${budget.callCount}
Completed autonomously — zero human intervention
    `.trim()

    this.log('Research complete.')

    return { recommendation, cost: budget.spent }
  }
}

async function main() {
  const secretKey = process.env.STELLAR_SECRET_KEY
  if (!secretKey) {
    console.error('Please set STELLAR_SECRET_KEY environment variable')
    process.exit(1)
  }

  const agent = new ResearchAgent(secretKey)

  console.log('\n' + '='.repeat(60))
  console.log('AUTONOMOUS AI RESEARCH AGENT')
  console.log('='.repeat(60) + '\n')

  const result = await agent.research(['NVDA', 'TSLA', 'AAPL'])

  console.log('\n' + '='.repeat(60))
  console.log(result.recommendation)
  console.log('='.repeat(60) + '\n')
}

main().catch(console.error)
