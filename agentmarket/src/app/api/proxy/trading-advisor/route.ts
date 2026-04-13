/**
 * Trading Advisor Agent
 * Price: 0.5 XLM per call (mainnet)
 *
 * Agent-to-Agent composition:
 *   1. User pays 0.5 XLM → Trading Advisor (AGENTMARKET_WALLET)
 *   2. Trading Advisor pays 0.1 XLM → Stock Analyst (x402, from TRADING_ADVISOR_WALLET_SECRET)
 *   3. Trading Advisor runs two-stage Gemini analysis on top of Stock Analyst data
 *   4. Returns BUY/HOLD/SELL with both tx hashes in response — verifiable on Stellar explorer
 *
 * This is real A2A composition: two agents, two wallets, two on-chain payments per call.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { withX402Payment, PaymentVerificationResult } from '@/lib/x402/middleware'

const API_NAME = 'Trading Advisor'
const API_ID = 'trading-advisor'
const PRICE_XLM = 0.5

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY_4
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash-lite'

// Trading Advisor agent wallet — pays Stock Analyst for data
const TRADING_ADVISOR_SECRET = process.env.TRADING_ADVISOR_WALLET_SECRET || ''
const TRADING_ADVISOR_PUBLIC = 'GCIWVZ3X4NPBGNECWB7VDTW2O6AGS5ISPCG23MZM2YNMV6FUH4JYOBGP'

// Stock Analyst endpoint (internal — same server)
const INTERNAL_BASE = `http://localhost:${process.env.PORT || 3001}`
const STOCK_ANALYST_URL = `${INTERNAL_BASE}/api/proxy/stock-analyst`

// Stellar mainnet
const HORIZON_URL = 'https://horizon.stellar.org'
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC

// ── Types ────────────────────────────────────────────────────────────────────

interface StockAnalystData {
  symbol: string
  companyName: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  reason: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  volume: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  analysisBy: string
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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

// ── A2A: pay Stock Analyst via x402 ──────────────────────────────────────────

async function callStockAnalystViaX402(symbol: string): Promise<{ data: StockAnalystData; txHash: string }> {
  if (!TRADING_ADVISOR_SECRET) {
    throw new Error('TRADING_ADVISOR_WALLET_SECRET not configured on server')
  }

  // Step 1 — trigger the 402
  const probe = await fetch(`${STOCK_ANALYST_URL}?symbol=${encodeURIComponent(symbol)}`)

  if (probe.status !== 402) {
    if (probe.ok) {
      // Already paid somehow — shouldn't happen but handle it
      const data = await probe.json() as StockAnalystData
      return { data, txHash: 'no-payment-required' }
    }
    throw new Error(`Stock Analyst returned unexpected status ${probe.status}`)
  }

  const paymentDetails = await probe.json() as {
    payment?: { recipient?: string; amount?: string; memo?: string }
  }

  const recipient = paymentDetails.payment?.recipient
  const amount = paymentDetails.payment?.amount
  const memo = paymentDetails.payment?.memo || `am:stock-analyst:${Date.now()}`

  if (!recipient || !amount) {
    throw new Error('Invalid 402 from Stock Analyst — missing recipient or amount')
  }

  // Step 2 — pay 0.1 XLM from Trading Advisor wallet
  const keypair = StellarSdk.Keypair.fromSecret(TRADING_ADVISOR_SECRET)
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)

  const account = await server.loadAccount(keypair.publicKey())

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipient,
        asset: StellarSdk.Asset.native(),
        amount,
      })
    )
    .addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    .setTimeout(30)
    .build()

  tx.sign(keypair)

  const result = await server.submitTransaction(tx)
  const txHash = result.hash

  // Step 3 — retry Stock Analyst with payment proof
  const proof = JSON.stringify({ txHash, network: 'mainnet', timestamp: Date.now() })

  const retry = await fetch(`${STOCK_ANALYST_URL}?symbol=${encodeURIComponent(symbol)}`, {
    headers: {
      'X-Payment-Proof': proof,
      'X-Payment-TxHash': txHash,
      'X-Payment-Network': 'mainnet',
    },
  })

  if (!retry.ok) {
    throw new Error(`Stock Analyst rejected payment proof: ${retry.status}`)
  }

  const data = await retry.json() as StockAnalystData
  return { data, txHash }
}

// ── Gemini: trading recommendation on top of stock analyst data ───────────────

function ruleBasedRecommendation(data: StockAnalystData): TradingRecommendation {
  const { price, changePercent, fiftyTwoWeekHigh, fiftyTwoWeekLow, sentiment } = data
  const range = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const positionInRange = range > 0 ? (price - fiftyTwoWeekLow) / range : 0.5

  let action: 'BUY' | 'HOLD' | 'SELL' = 'HOLD'
  let confidence = 50
  const reasons: string[] = []

  if (sentiment === 'bullish' && changePercent > 0 && positionInRange < 0.75) {
    action = 'BUY'
    confidence = 65
    reasons.push(`Stock Analyst sentiment: ${sentiment}`)
    reasons.push(`Upward momentum at ${changePercent.toFixed(2)}%`)
    reasons.push(`Trading at ${(positionInRange * 100).toFixed(0)}% of 52-week range`)
  } else if (sentiment === 'bearish' || changePercent < -2 || positionInRange > 0.9) {
    action = 'SELL'
    confidence = 60
    reasons.push(`Stock Analyst sentiment: ${sentiment}`)
    reasons.push(`Downward pressure: ${changePercent.toFixed(2)}%`)
    if (positionInRange > 0.9) reasons.push('Near 52-week high — elevated risk')
  } else {
    reasons.push(`Stock Analyst sentiment: ${sentiment}`)
    reasons.push(`Price action neutral at ${changePercent.toFixed(2)}%`)
    reasons.push('Mid-range positioning suggests consolidation')
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
  data: StockAnalystData
): Promise<{ recommendation: TradingRecommendation; analysisBy: string }> {
  if (!GEMINI_API_KEY) {
    return { recommendation: ruleBasedRecommendation(data), analysisBy: 'rule-based' }
  }

  const prompt = `You are a professional trading advisor. You have received a Stock Analyst report and must produce an actionable trading recommendation.

Stock Analyst Report for ${data.symbol} (${data.companyName}):
- Current Price: $${data.price}
- Change Today: ${data.changePercent.toFixed(2)}% ($${data.change.toFixed(2)})
- Analyst Sentiment: ${data.sentiment.toUpperCase()}
- Analyst Reasoning: ${data.reason}
- Volume: ${data.volume}
- 52-Week Range: $${data.fiftyTwoWeekLow} – $${data.fiftyTwoWeekHigh}

Based on this analyst report, respond ONLY with valid JSON (no markdown, no commentary):
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

Entry/exit/stopLoss must be realistic dollar targets relative to $${data.price}.`

  try {
    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400 },
        }),
      }
    )

    if (!res.ok) throw new Error(`Gemini ${res.status}`)

    const geminiData = (await res.json()) as GeminiResponse
    const rawText = geminiData.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!rawText) throw new Error('Empty Gemini response')

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonText) as Partial<TradingRecommendation>
    const fallback = ruleBasedRecommendation(data)

    const validActions = new Set(['BUY', 'HOLD', 'SELL'])
    const validHorizons = new Set(['short', 'medium', 'long'])
    const validRisk = new Set(['LOW', 'MEDIUM', 'HIGH'])

    return {
      recommendation: {
        action: validActions.has(parsed.action ?? '') ? parsed.action as 'BUY' | 'HOLD' | 'SELL' : fallback.action,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : fallback.confidence,
        entryTarget: typeof parsed.entryTarget === 'number' ? parsed.entryTarget : fallback.entryTarget,
        exitTarget: typeof parsed.exitTarget === 'number' ? parsed.exitTarget : fallback.exitTarget,
        stopLoss: typeof parsed.stopLoss === 'number' ? parsed.stopLoss : fallback.stopLoss,
        timeHorizon: validHorizons.has(parsed.timeHorizon ?? '') ? parsed.timeHorizon as 'short' | 'medium' | 'long' : fallback.timeHorizon,
        riskLevel: validRisk.has(parsed.riskLevel ?? '') ? parsed.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' : fallback.riskLevel,
        reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0 ? parsed.reasons.slice(0, 5).map(String) : fallback.reasons,
      },
      analysisBy: GEMINI_MODEL,
    }
  } catch (err) {
    console.error('[trading-advisor] Gemini fallback:', err instanceof Error ? err.message : String(err))
    return { recommendation: ruleBasedRecommendation(data), analysisBy: 'gemini-fallback' }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function tradingAdvisorHandler(
  request: NextRequest,
  payment: PaymentVerificationResult
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') || 'AAPL').toUpperCase().trim()

  let stockData: StockAnalystData
  let stockTxHash: string

  try {
    const result = await callStockAnalystViaX402(symbol)
    stockData = result.data
    stockTxHash = result.txHash
  } catch (err) {
    console.error('[trading-advisor] Stock Analyst A2A call failed:', err)
    return NextResponse.json(
      { error: 'Failed to fetch data from Stock Analyst agent', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  const { recommendation, analysisBy } = await geminiRecommendation(stockData)

  return NextResponse.json({
    symbol: stockData.symbol,
    companyName: stockData.companyName,
    currentPrice: stockData.price,
    changePercent: stockData.changePercent,
    recommendation,
    marketContext: {
      volume: stockData.volume,
      fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stockData.fiftyTwoWeekLow,
    },
    analysisBy,
    // A2A composition proof — both payments visible on Stellar explorer
    composition: {
      userPayment: {
        txHash: payment.txHash,
        amount: '0.5 XLM',
        to: 'Trading Advisor',
        explorerUrl: `https://stellar.expert/explorer/public/tx/${payment.txHash}`,
      },
      agentPayment: {
        txHash: stockTxHash,
        amount: '0.1 XLM',
        from: `Trading Advisor (${TRADING_ADVISOR_PUBLIC})`,
        to: 'Stock Analyst',
        explorerUrl: `https://stellar.expert/explorer/public/tx/${stockTxHash}`,
      },
      stockAnalystSentiment: stockData.sentiment,
      stockAnalystReason: stockData.reason,
      margin: '0.4 XLM captured by Trading Advisor',
    },
    timestamp: new Date().toISOString(),
  })
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_XLM, tradingAdvisorHandler)
