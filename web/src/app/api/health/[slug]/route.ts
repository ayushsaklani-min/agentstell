import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const response = await fetch(new URL(`/api/health/${slug}`, getBackendBaseUrl()))
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Backend unavailable', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    )
  }
}
