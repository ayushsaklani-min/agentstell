/**
 * Stock Analyst API Proxy
 * Price: 0.005 USDC per call
 *
 * Fetches live stock data from Yahoo Finance and feeds it to Gemini
 * for sentiment analysis, returning structured JSON with price data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment, PaymentVerificationResult } from '@/lib/x402/middleware'

const API_NAME = 'Stock Analyst'
const API_ID = 'stock-analyst'
const PRICE_USDC = 0.005

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY_4
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

// Yahoo Finance chart API — no key required
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

// ----- Yahoo Finance response types -----

interface YahooMeta {
  symbol?: string
  longName?: string
  shortName?: string
  regularMarketPrice?: number
  previousClose?: number
  regularMarketVolume?: number
  regularMarketChangePercent?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
}

interface YahooChartResult {
  meta?: YahooMeta
  timestamp?: number[]
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[] | null
    error?: { code?: string; description?: string } | null
  }
}

// ----- Gemini response types -----

interface GeminiContent {
  parts?: Array<{ text?: string }>
}

interface GeminiCandidate {
  content?: GeminiContent
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
}

interface SentimentResult {
  sentiment: 'bullish' | 'bearish' | 'neutral'
  reason: string
}

// ----- Helper: fetch Yahoo Finance data -----

async function fetchStockData(symbol: string): Promise<YahooMeta> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=5d`

  const response = await fetch(url, {
    headers: {
      // Some Yahoo Finance endpoints need a browser-like user-agent
      'User-Agent': 'Mozilla/5.0 (compatible; AgentMarket/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${response.status}`)
  }

  const data = (await response.json()) as YahooChartResponse

  if (data.chart?.error) {
    const code = data.chart.error.code || 'UNKNOWN'
    throw Object.assign(
      new Error(data.chart.error.description || 'Yahoo Finance error'),
      { yahooCode: code }
    )
  }

  const result = data.chart?.result?.[0]
  if (!result?.meta) {
    throw Object.assign(new Error('Symbol not found'), { yahooCode: 'Not Found' })
  }

  return result.meta
}

// ----- Helper: rule-based fallback sentiment -----

function ruleBasedSentiment(changePercent: number): SentimentResult {
  if (changePercent > 1.5) {
    return {
      sentiment: 'bullish',
      reason: `Stock is up ${changePercent.toFixed(2)}%, showing positive momentum.`,
    }
  }
  if (changePercent < -1.5) {
    return {
      sentiment: 'bearish',
      reason: `Stock is down ${Math.abs(changePercent).toFixed(2)}%, indicating selling pressure.`,
    }
  }
  return {
    sentiment: 'neutral',
    reason: `Stock moved only ${changePercent.toFixed(2)}%, within normal daily variance.`,
  }
}

// ----- Helper: Gemini sentiment analysis -----

async function geminiSentiment(
  symbol: string,
  meta: YahooMeta
): Promise<SentimentResult & { analysisBy: string }> {
  const companyName = meta.longName || meta.shortName || symbol
  const price = meta.regularMarketPrice ?? 0
  const previousClose = meta.previousClose ?? 0
  const changePercent = meta.regularMarketChangePercent ?? 0
  const volume = meta.regularMarketVolume ?? 0
  const high52 = meta.fiftyTwoWeekHigh ?? 0
  const low52 = meta.fiftyTwoWeekLow ?? 0

  if (!GEMINI_API_KEY) {
    return { ...ruleBasedSentiment(changePercent), analysisBy: 'rule-based' }
  }

  const prompt = `You are a stock market analyst. Analyze the following stock data and provide a trading sentiment.

Stock: ${symbol} (${companyName})
Current Price: $${price}
Previous Close: $${previousClose}
Change: ${changePercent.toFixed(2)}%
Volume: ${volume}
52-Week Range: $${low52} - $${high52}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"sentiment": "bullish" | "bearish" | "neutral", "reason": "one clear sentence explaining the sentiment"}`

  try {
    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200 },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error(
        `[stock-analyst] Gemini HTTP ${res.status} for ${symbol}:`,
        errText.slice(0, 200)
      )
      throw new Error(`Gemini API error: ${res.status}`)
    }

    const geminiData = (await res.json()) as GeminiResponse
    const rawText = geminiData.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!rawText) {
      console.error(`[stock-analyst] Empty Gemini response for ${symbol}`)
      throw new Error('Empty Gemini response')
    }

    // Strip optional markdown fences before parsing
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: { sentiment?: string; reason?: string }
    try {
      parsed = JSON.parse(jsonText) as { sentiment?: string; reason?: string }
    } catch (parseErr) {
      console.error(
        `[stock-analyst] JSON parse failed for ${symbol}. Raw text: ${rawText.slice(0, 150)}`
      )
      throw parseErr
    }

    const validSentiments = new Set(['bullish', 'bearish', 'neutral'])
    const sentiment = validSentiments.has(parsed.sentiment ?? '')
      ? (parsed.sentiment as 'bullish' | 'bearish' | 'neutral')
      : ruleBasedSentiment(changePercent).sentiment

    return {
      sentiment,
      reason: typeof parsed.reason === 'string' ? parsed.reason : ruleBasedSentiment(changePercent).reason,
      analysisBy: GEMINI_MODEL,
    }
  } catch (err) {
    console.error(
      `[stock-analyst] Gemini fallback for ${symbol}:`,
      err instanceof Error ? err.message : String(err)
    )
    return { ...ruleBasedSentiment(changePercent), analysisBy: 'gemini-fallback' }
  }
}

// ----- Main handler -----

async function stockAnalystHandler(
  request: NextRequest,
  _payment: PaymentVerificationResult
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') || 'AAPL').toUpperCase().trim()

  let meta: YahooMeta
  try {
    meta = await fetchStockData(symbol)
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      (err as Error & { yahooCode?: string }).yahooCode === 'Not Found'

    if (isNotFound) {
      return NextResponse.json(
        { error: `Symbol not found: ${symbol}` },
        { status: 404 }
      )
    }

    console.error('Yahoo Finance fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch stock data from Yahoo Finance' },
      { status: 502 }
    )
  }

  const price = meta.regularMarketPrice ?? 0
  let previousClose = meta.previousClose ?? 0
  const changePercent = meta.regularMarketChangePercent ?? 0

  // Data quality check: if previousClose is missing/zero, derive from price and changePercent
  if (previousClose === 0 && price > 0 && changePercent !== 0) {
    previousClose = price / (1 + changePercent / 100)
    console.warn(`[stock-analyst] ${symbol}: previousClose missing, derived from price and changePercent`)
  }

  // Calculate change: prefer derived previousClose, or use changePercent to compute
  let change = price - previousClose
  if (Math.abs(change) < 0.0001 && changePercent !== 0) {
    change = price * (changePercent / 100)
  }

  const { sentiment, reason, analysisBy } = await geminiSentiment(symbol, meta)

  return NextResponse.json({
    symbol,
    companyName: meta.longName || meta.shortName || symbol,
    sentiment,
    reason,
    price,
    previousClose: Math.round(previousClose * 10000) / 10000,
    change: Math.round(change * 10000) / 10000,
    changePercent: Math.round(changePercent * 10000) / 10000,
    volume: meta.regularMarketVolume ?? 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
    analysisBy,
    timestamp: new Date().toISOString(),
  })
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, stockAnalystHandler)
