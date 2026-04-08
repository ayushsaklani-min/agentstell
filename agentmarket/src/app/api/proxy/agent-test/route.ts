import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/middleware'

const API_NAME = 'Agent Test'
const API_ID = 'agent-test'
const PRICE_USDC = 0.001

async function agentTestHandler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const task = searchParams.get('task') || 'validate sdk payment flow'
  const agentId = searchParams.get('agentId') || 'unknown-agent'

  return NextResponse.json({
    api: API_ID,
    accepted: true,
    task,
    agentId,
    processedAt: new Date().toISOString(),
    paymentModel: 'x402',
    note: 'Live AgentMarket test endpoint',
  })
}

export const GET = withX402Payment(API_NAME, API_ID, PRICE_USDC, agentTestHandler)
