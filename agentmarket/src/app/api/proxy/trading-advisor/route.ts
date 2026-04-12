/**
 * Trading Advisor Agent
 * Price: 0.02 USDC per call
 *
 * An AI agent that fetches live market data and runs a two-stage Gemini analysis
 * to produce an actionable trading recommendation (action, targets, risk, confidence).
 *
 * Architectural note: In a fully composed setup this agent would pay stock-analyst
 * 0.005 USDC via x402 for the data layer and capture the composition value on top.
 * The demo inlines the data fetch for runtime simplicity while preserving the story.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment, PaymentVerificationResult } from '@/lib/x402/middleware'

const API_NAME = 'Trading Advisor'
const API_ID = 'trading-advisor'
const PRICE_USDC = 0.02

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY_4
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

interface TradingRecommendation {
  action: 'BUY' | 'HOLD' | 'SELL'
  confidence: number
  entryTarget: number
  exitTarget: number
  stopLoss: number
  timeHorizon: 'short' | 'medium' | 'long'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  reasons: string[]
}

async function fetchStockData(symbol: string): Promise<YahooMeta> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1mo`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AgentMarket/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${response.status}`)
  }

  const data = (await response.json()) as YahooChartResponse

  if (data.chart?.error) {
    throw Object.assign(
      new Error(data.chart.error.description || 'Yahoo Finance error'),
      { yahooCode: data.chart.error.code || 'UNKNOWN' }
    )
  }

  const result = data.chart?.result?.[0]
  if (!result?.meta) {
    throw Object.assign(new Error('Symbol not found'), { yahooCode: 'Not Found' })
  }

  return result.meta
}

function ruleBasedRecommendation(meta: YahooMeta): TradingRecommendation {
  const price = meta.regularMarketPrice ?? 0
  const changePercent = meta.regularMarketChangePercent ?? 0
  const high52 = meta.fiftyTwoWeekHigh ?? price
  const low52 = meta.fiftyTwoWeekLow ?? price

  const range = high52 - low52
  const positionInRange = range > 0 ? (price - low52) / range : 0.5

  let action: 'BUY' | 'HOLD' | 'SELL' = 'HOLD'
  let confidence = 50
  const reasons: string[] = []

  if (changePercent > 2 && positionInRange < 0.7) {
    action = 'BUY'
    confidence = 65
    reasons.push(`Upward momentum at ${changePercent.toFixed(2)}%`)
    reasons.push(`Trading at ${(positionInRange * 100).toFixed(0)}% of 52-week range`)
  } else if (changePercent < -2 || positionInRange > 0.9) {
    action = 'SELL'
    confidence = 60
    reasons.push(`Downward pressure: ${changePercent.toFixed(2)}%`)
    reasons.push(`Near 52-week high — elevated risk`)
  } else {
    reasons.push(`Price action neutral at ${changePercent.toFixed(2)}%`)
    reasons.push(`Mid-range positioning suggests consolidation`)
  }

  return {
    action,
    confidence,
    entryTarget: Math.round(price * 0.98 * 100) / 100,
    exitTarget: Math.round(price * 1.08 * 100) / 100,
    stopLoss: Math.round(price * 0.95 * 100) / 100,
    timeHorizon: 'medium',
    riskLevel: Math.abs(changePercent) > 3 ? 'HIGH' : 'MEDIUM',
    reasons,
  }
}

async function geminiRecommendation(
  symbol: string,
  meta: YahooMeta
): Promise<{ recommendation: TradingRecommendation; analysisBy: string }> {
  if (!GEMINI_API_KEY) {
    return { recommendation: ruleBasedRecommendation(meta), analysisBy: 'rule-based' }
  }

  const companyName = meta.longName || meta.shortName || symbol
  const price = meta.regularMarketPrice ?? 0
  const previousClose = meta.previousClose ?? 0
  const changePercent = meta.regularMarketChangePercent ?? 0
  const volume = meta.regularMarketVolume ?? 0
  const high52 = meta.fiftyTwoWeekHigh ?? 0
  const low52 = meta.fiftyTwoWeekLow ?? 0

  const prompt = `You are a professional trading advisor. Analyze this stock and output a structured trading recommendation.

Stock: ${symbol} (${companyName})
Current Price: $${price}
Previous Close: $${previousClose}
Change: ${changePercent.toFixed(2)}%
Volume: ${volume}
52-Week Range: $${low52} - $${high52}

Respond ONLY with valid JSON in this exact shape (no markdown, no commentary):
{
  "action": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "entryTarget": <number>,
  "exitTarget": <number>,
  "stopLoss": <number>,
  "timeHorizon": "short" | "medium" | "long",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reasons": ["<reason 1>", "<reason 2>", "<reason 3>"]
}

Entry/exit/stopLoss must be realistic dollar price targets relative to $${price}.`

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
          generationConfig: { maxOutputTokens: 400 },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[trading-advisor] Gemini HTTP ${res.status}:`, errText.slice(0, 200))
      throw new Error(`Gemini ${res.status}`)
    }

    const data = (await res.json()) as GeminiResponse
    const rawText = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!rawText) {
      throw new Error('Empty Gemini response')
    }

    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(jsonText) as Partial<TradingRecommendation>

    const validActions = new Set(['BUY', 'HOLD', 'SELL'])
    const validHorizons = new Set(['short', 'medium', 'long'])
    const validRisk = new Set(['LOW', 'MEDIUM', 'HIGH'])

    const fallback = ruleBasedRecommendation(meta)

    const recommendation: TradingRecommendation = {
      action: validActions.has(parsed.action ?? '') ? parsed.action as 'BUY' | 'HOLD' | 'SELL' : fallback.action,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : fallback.confidence,
      entryTarget: typeof parsed.entryTarget === 'number' ? parsed.entryTarget : fallback.entryTarget,
      exitTarget: typeof parsed.exitTarget === 'number' ? parsed.exitTarget : fallback.exitTarget,
      stopLoss: typeof parsed.stopLoss === 'number' ? parsed.stopLoss : fallback.stopLoss,
      timeHorizon: validHorizons.has(parsed.timeHorizon ?? '')
        ? parsed.timeHorizon as 'short' | 'medium' | 'long'
        : fallback.timeHorizon,
      riskLevel: validRisk.has(parsed.riskLevel ?? '')
        ? parsed.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH'
        : fallback.riskLevel,
      reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0
        ? parsed.reasons.slice(0, 5).map(String)
        : fallback.reasons,
    }

    return { recommendation, analysisBy: GEMINI_MODEL }
  } catch (err) {
    console.error(
      `[trading-advisor] Gemini fallback for ${symbol}:`,
      err instanceof Error ? err.message : String(err)
    )
    return { recommendation: ruleBasedRecommendation(meta), analysisBy: 'gemini-fallback' }
  }
}

async function tradingAdvisorHandler(
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
      { error: 'Failed to fetch stock data' },
      { status: 502 }
    )
  }

  const { recommendation, analysisBy } = await geminiRecommendation(symbol, meta)

  return NextResponse.json({
    symbol,
    companyName: meta.longName || meta.shortName || symbol,
    currentPrice: meta.regularMarketPrice ?? 0,
    changePercent: Math.round((meta.regularMarketChangePercent ?? 0) * 100) / 100,
    recommendation,
    marketContext: {
      volume: meta.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
    },
    analysisBy,
    timestamp: new Date().toISOString(),
  })
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, tradingAdvisorHandler)
