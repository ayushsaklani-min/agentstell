/**
 * AI Inference API Proxy
 * Price: 0.005 USDC per call
 */

import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'AI Inference'
const API_ID = 'ai'
const PRICE_USDC = 0.005

// Model provider configuration
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY_4
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'
const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo'

interface AIRequestPayload {
  prompt?: string
  model?: string
}

async function aiHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const body = await readRequestBody(request)
  const prompt = searchParams.get('prompt') || body.prompt
  const requestedModel = searchParams.get('model') || body.model

  if (!prompt) {
    return NextResponse.json(
      { error: 'Missing required parameter: prompt' },
      { status: 400 }
    )
  }

  const provider = selectProvider(requestedModel)
  const model = resolveModel(provider, requestedModel)

  // If no provider key is configured, return mock data
  if ((provider === 'gemini' && !GEMINI_API_KEY) || (provider === 'openai' && !OPENAI_API_KEY)) {
    return NextResponse.json(getMockAIResponse(prompt, model))
  }

  try {
    if (provider === 'gemini') {
      const result = await callGemini(prompt, model)
      return NextResponse.json(result)
    }

    const result = await callOpenAI(prompt, model)
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json(getMockAIResponse(prompt, model))
  }
}

async function readRequestBody(request: NextRequest): Promise<AIRequestPayload> {
  if (request.method !== 'POST') {
    return {}
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return await request.json() as AIRequestPayload
  } catch {
    return {}
  }
}

function selectProvider(model?: string): 'gemini' | 'openai' {
  if (model?.toLowerCase().includes('gemini')) {
    return 'gemini'
  }

  if (GEMINI_API_KEY && !OPENAI_API_KEY) {
    return 'gemini'
  }

  return 'openai'
}

function resolveModel(provider: 'gemini' | 'openai', requestedModel?: string) {
  if (!requestedModel) {
    return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL
  }

  if (provider === 'gemini' && !requestedModel.toLowerCase().includes('gemini')) {
    return DEFAULT_GEMINI_MODEL
  }

  return requestedModel
}

async function callGemini(prompt: string, model: string) {
  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
      finishReason?: string
    }>
    usageMetadata?: {
      totalTokenCount?: number
    }
    modelVersion?: string
  }
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts
    ?.map((part) => part.text || '')
    .join('\n')
    .trim()

  return {
    response: text || 'No Gemini response returned.',
    model: data.modelVersion || model,
    tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    finishReason: candidate?.finishReason || 'STOP',
  }
}

async function callOpenAI(prompt: string, model: string) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const choice = data.choices[0]

  return {
    response: choice.message.content,
    model: data.model,
    tokensUsed: data.usage.total_tokens,
    finishReason: choice.finish_reason,
  }
}

function getMockAIResponse(prompt: string, model: string) {
  // Generate a mock response based on the prompt
  const responses: Record<string, string> = {
    default: `This is a simulated AI response to your prompt: "${prompt.slice(0, 50)}...". In a production environment, this would connect to OpenAI's API for real inference.`,
  }

  const promptLower = prompt.toLowerCase()
  let response = responses.default

  if (promptLower.includes('weather') || promptLower.includes('travel')) {
    response = `Based on the weather and air quality data, I recommend visiting cities with lower pollution levels and pleasant temperatures. Consider checking the AQI before planning outdoor activities.`
  } else if (promptLower.includes('recommend')) {
    response = `Based on my analysis, I recommend focusing on locations with better environmental conditions for your travel. Consider factors like air quality, weather, and local events.`
  } else if (promptLower.includes('explain') || promptLower.includes('what is')) {
    response = `Let me explain: ${prompt.replace(/explain|what is/gi, '').trim()} is a complex topic that involves multiple factors. For a comprehensive understanding, consider looking at recent research and expert opinions in the field.`
  }

  return {
    response,
    model: model,
    tokensUsed: Math.floor(response.length / 4),
    finishReason: 'stop',
  }
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, aiHandler)
export const POST = withX402Payment(API_NAME, API_ID, PRICE_USDC, aiHandler)
