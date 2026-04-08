import { NextRequest, NextResponse } from 'next/server';

const FORWARDED_HEADERS = [
  'content-type',
  'x-payment-proof',
  'x-payment-txhash',
  'x-payment-network',
];

const RESPONSE_HEADERS = [
  'content-type',
  'x-payment-txhash',
  'x-payment-amount',
];

function getBackendBaseUrl() {
  return (process.env.AGENTMARKET_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();

  for (const headerName of FORWARDED_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

async function proxyRequest(
  request: NextRequest,
  api: string
) {
  try {
    const backendUrl = new URL(
      `/api/proxy/${api}${request.nextUrl.search}`,
      getBackendBaseUrl()
    );

    const response = await fetch(backendUrl, {
      method: request.method,
      headers: buildForwardHeaders(request),
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
    });

    const responseHeaders = new Headers();
    for (const headerName of RESPONSE_HEADERS) {
      const value = response.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    }

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AgentMarket backend unavailable',
        details: error instanceof Error ? error.message : 'Unknown proxy error',
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ api: string }> }
) {
  const { api } = await params;
  return proxyRequest(request, api);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ api: string }> }
) {
  const { api } = await params;
  return proxyRequest(request, api);
}
