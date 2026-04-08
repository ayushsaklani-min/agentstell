/**
 * AI Agent Research Example
 * 
 * This example demonstrates how an autonomous AI agent can use the
 * AgentMarket SDK to research travel destinations by gathering
 * weather, air quality, and news data for multiple cities.
 */

import { AgentMarket, type ApiResult } from '../src'

// Simulated AI Agent that uses AgentMarket for data gathering
class ResearchAgent {
  private sdk: AgentMarket
  private logs: string[] = []

  constructor(secretKey: string) {
    this.sdk = new AgentMarket({
      secretKey,
      network: 'testnet',
      budgetLimits: {
        maxPerCall: 0.01,
        maxPerSession: 0.5, // $0.50 max for this research task
      },
      debug: false,
    })

    // Log all events
    this.sdk.on((event) => {
      if (event.type === 'payment_confirmed') {
        this.log(`Paid $${event.data.cost} USDC for ${event.data.apiName}`)
      }
    })
  }

  private log(message: string) {
    const timestamp = new Date().toISOString().slice(11, 19)
    const entry = `[${timestamp}] ${message}`
    this.logs.push(entry)
    console.log(entry)
  }

  async research(task: string): Promise<{
    recommendation: string
    data: Record<string, unknown>
    cost: number
  }> {
    this.log(`Task: ${task}`)
    this.log('Starting research...')

    const cities = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bangalore']
    const results: Record<string, {
      weather?: { temp: number; conditions: string }
      airQuality?: { aqi: number; category: string }
    }> = {}

    // Gather data for each city
    for (const city of cities) {
      this.log(`Researching ${city}...`)
      results[city] = {}

      // Get weather
      const weather = await this.sdk.weather(city)
      if (weather.success && weather.data) {
        results[city].weather = {
          temp: weather.data.temp,
          conditions: weather.data.conditions,
        }
        this.log(`   Weather: ${weather.data.temp}°C, ${weather.data.conditions}`)
      }

      // Get air quality
      const air = await this.sdk.airQuality(city)
      if (air.success && air.data) {
        results[city].airQuality = {
          aqi: air.data.aqi,
          category: air.data.category,
        }
        this.log(`   AQI: ${air.data.aqi} (${air.data.category})`)
      }
    }

    // Get relevant news
    this.log('Fetching travel news...')
    const news = await this.sdk.news('India travel pollution', 3)
    if (news.success) {
      this.log(`   Found ${news.data?.totalResults} relevant articles`)
    }

    // Analyze and recommend
    this.log('Analyzing data...')
    
    // Find best city (lowest AQI + nice weather)
    let bestCity = ''
    let bestScore = Infinity

    for (const [city, data] of Object.entries(results)) {
      if (data.airQuality && data.weather) {
        // Score = AQI (lower is better) + weather penalty if bad
        let score = data.airQuality.aqi
        if (data.weather.temp > 35 || data.weather.temp < 15) score += 50
        if (data.weather.conditions.toLowerCase().includes('rain')) score += 30
        
        if (score < bestScore) {
          bestScore = score
          bestCity = city
        }
      }
    }

    const budget = this.sdk.getBudgetStatus()
    const bestData = results[bestCity]

    const recommendation = `
WEEKEND TRAVEL RECOMMENDATION

Based on analysis of weather and air quality across ${cities.length} Indian cities:

Recommended Destination: ${bestCity}

- Air Quality Index: ${bestData?.airQuality?.aqi} (${bestData?.airQuality?.category})
- Temperature: ${bestData?.weather?.temp}°C
- Conditions: ${bestData?.weather?.conditions}

Research Cost: $${budget.spent.toFixed(4)} USDC
API Calls Made: ${budget.callCount}
Completed autonomously with zero human intervention
    `.trim()

    this.log('Research complete.')

    return {
      recommendation,
      data: results,
      cost: budget.spent,
    }
  }
}

// Run the research agent
async function main() {
  const secretKey = process.env.STELLAR_SECRET_KEY
  if (!secretKey) {
    console.error('Please set STELLAR_SECRET_KEY environment variable')
    process.exit(1)
  }

  const agent = new ResearchAgent(secretKey)
  
  const task = 'Research air quality, weather, and top news for the 5 most polluted Indian cities today and give me a weekend travel recommendation.'
  
  console.log('\n' + '='.repeat(60))
  console.log('AUTONOMOUS AI RESEARCH AGENT')
  console.log('='.repeat(60) + '\n')

  const result = await agent.research(task)

  console.log('\n' + '='.repeat(60))
  console.log(result.recommendation)
  console.log('='.repeat(60) + '\n')
}

main().catch(console.error)
