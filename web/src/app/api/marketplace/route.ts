import { NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET() {
  try {
    const response = await fetch(new URL('/api/marketplace', getBackendBaseUrl()))
    const body = await response.text()

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AgentMarket backend unavailable',
        details: error instanceof Error ? error.message : 'Unknown marketplace proxy error',
      },
      { status: 502 }
    )
  }
}
