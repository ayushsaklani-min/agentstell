import { NextRequest, NextResponse } from 'next/server'

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.text()
    const response = await fetch(new URL(`/api/wanted/${id}`, getBackendBaseUrl()), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, {
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
