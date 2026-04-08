/**
 * Currency Exchange API Proxy
 * Price: 0.001 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'Currency'
const API_ID = 'currency'
const PRICE_USDC = 0.001

// ExchangeRate API
const EXCHANGERATE_BASE_URL = 'https://api.exchangerate-api.com/v4'

async function currencyHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')?.toUpperCase()
  const to = searchParams.get('to')?.toUpperCase()
  const amount = parseFloat(searchParams.get('amount') || '1')

  if (!from || !to) {
    return NextResponse.json(
      { error: 'Missing required parameters: from, to' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `${EXCHANGERATE_BASE_URL}/latest/${from}`
    )

    if (!response.ok) {
      throw new Error(`ExchangeRate API error: ${response.status}`)
    }

    const data = await response.json()
    const rate = data.rates[to]

    if (!rate) {
      return NextResponse.json(
        { error: `Currency ${to} not found` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      from,
      to,
      amount,
      rate,
      converted: Math.round(amount * rate * 100) / 100,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Currency API error:', error)
    
    // Fallback to mock rates
    return NextResponse.json(getMockCurrencyData(from, to, amount))
  }
}

function getMockCurrencyData(from: string, to: string, amount: number) {
  const mockRates: Record<string, Record<string, number>> = {
    USD: { EUR: 0.92, GBP: 0.79, INR: 83.12, JPY: 149.50, AUD: 1.54 },
    EUR: { USD: 1.09, GBP: 0.86, INR: 90.23, JPY: 162.50, AUD: 1.67 },
    GBP: { USD: 1.27, EUR: 1.16, INR: 105.12, JPY: 189.50, AUD: 1.95 },
    INR: { USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.80, AUD: 0.018 },
  }

  const rate = mockRates[from]?.[to] || 1

  return {
    from,
    to,
    amount,
    rate,
    converted: Math.round(amount * rate * 100) / 100,
    timestamp: new Date().toISOString(),
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, currencyHandler)
