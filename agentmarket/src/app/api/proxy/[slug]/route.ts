import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'
import { paymentRequired, verifyPayment } from '@/lib/x402/middleware'

export const dynamic = 'force-dynamic'

type ActiveListing = Awaited<ReturnType<typeof loadListing>>

async function loadListing(slug: string) {
  const prisma = getPrismaClient()

  return prisma.apiListing.findFirst({
    where: {
      slug,
      isActive: true,
    },
    include: {
      provider: {
        select: {
          id: true,
          stellarAddress: true,
          totalEarnings: true,
        },
      },
    },
  })
}

async function recordCall(
  listing: NonNullable<ActiveListing>,
  payload: {
    callerAddress: string
    txHash: string
    amountUsdc: number
    success: boolean
    latencyMs: number
    errorMessage?: string
  }
) {
  const prisma = getPrismaClient()
  const totalCalls = listing.totalCalls + 1
  const successfulCallsBefore = Math.round((listing.successRate / 100) * listing.totalCalls)
  const successfulCallsAfter = successfulCallsBefore + (payload.success ? 1 : 0)
  const successRate =
    totalCalls > 0 ? (successfulCallsAfter / totalCalls) * 100 : 100
  const avgLatencyMs =
    totalCalls > 0
      ? Math.round(
          (listing.avgLatencyMs * listing.totalCalls + payload.latencyMs) / totalCalls
        )
      : payload.latencyMs

  await prisma.$transaction([
    prisma.apiCall.create({
      data: {
        apiListingId: listing.id,
        callerAddress: payload.callerAddress,
        txHash: payload.txHash,
        amountUsdc: payload.amountUsdc,
        success: payload.success,
        errorMessage: payload.errorMessage,
        latencyMs: payload.latencyMs,
      },
    }),
    prisma.apiListing.update({
      where: { id: listing.id },
      data: {
        totalCalls,
        successRate,
        avgLatencyMs,
      },
    }),
    prisma.provider.update({
      where: { id: listing.provider.id },
      data: {
        totalEarnings: {
          increment: payload.amountUsdc,
        },
      },
    }),
  ])
}

function buildUpstreamUrl(request: NextRequest, endpoint: string) {
  const url = new URL(endpoint)

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.append(key, value)
  }

  return url
}

const ACTIVE_NETWORK: 'testnet' | 'mainnet' =
  (process.env.STELLAR_NETWORK as 'testnet' | 'mainnet') || 'testnet'

async function executeListingRequest(
  request: NextRequest,
  listing: NonNullable<ActiveListing>
) {
  const startedAt = Date.now()
  const verification = await verifyPayment(request, listing.priceUsdc, {
    recipient: listing.provider.stellarAddress,
    network: ACTIVE_NETWORK,
  })

  if (!verification.valid || !verification.txHash) {
    return NextResponse.json(
      {
        error: 'Payment Verification Failed',
        message: verification.error,
      },
      { status: 402 }
    )
  }

  const body =
    listing.method === 'POST'
      ? await request.text()
      : undefined

  const UPSTREAM_TIMEOUT_MS = 15000

  try {
    const upstreamUrl = buildUpstreamUrl(request, listing.endpoint)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    const upstreamResponse = await fetch(upstreamUrl, {
      method: listing.method,
      headers: {
        Accept: 'application/json',
        ...(listing.method === 'POST'
          ? {
              'Content-Type':
                request.headers.get('content-type') || 'application/json',
            }
          : {}),
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    const responseBody = await upstreamResponse.text()
    const latencyMs = Date.now() - startedAt

    await recordCall(listing, {
      callerAddress: verification.callerAddress || 'unknown',
      txHash: verification.txHash,
      amountUsdc: verification.amount || listing.priceUsdc,
      success: upstreamResponse.ok,
      latencyMs,
      errorMessage: upstreamResponse.ok
        ? undefined
        : `Upstream ${upstreamResponse.status}`,
    })

    const response = new NextResponse(responseBody, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type':
          upstreamResponse.headers.get('content-type') || 'application/json',
      },
    })

    response.headers.set('X-Payment-TxHash', verification.txHash)
    response.headers.set(
      'X-Payment-Amount',
      (verification.amount || listing.priceUsdc).toFixed(6)
    )

    return response
  } catch (error) {
    const latencyMs = Date.now() - startedAt

    const isTimeout = error instanceof Error && error.name === 'AbortError'
    const errorMessage = isTimeout
      ? `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms`
      : error instanceof Error
        ? error.message
        : 'Unknown upstream proxy error'

    await recordCall(listing, {
      callerAddress: verification.callerAddress || 'unknown',
      txHash: verification.txHash,
      amountUsdc: verification.amount || listing.priceUsdc,
      success: false,
      latencyMs,
      errorMessage,
    })

    return NextResponse.json(
      {
        error: isTimeout ? 'Provider API timed out' : 'Provider API request failed',
        details: errorMessage,
      },
      { status: isTimeout ? 504 : 502 }
    )
  }
}

async function handleRequest(
  request: NextRequest,
  paramsPromise: Promise<{ slug: string }>
) {
  const { slug } = await paramsPromise
  const listing = await loadListing(slug)

  if (!listing) {
    return NextResponse.json(
      { error: 'API not found' },
      { status: 404 }
    )
  }

  if (listing.method !== request.method) {
    return NextResponse.json(
      { error: `Method ${request.method} not supported for ${slug}` },
      { status: 405 }
    )
  }

  if (!request.headers.has('X-Payment-Proof')) {
    return paymentRequired(
      listing.name,
      listing.slug,
      listing.priceUsdc,
      ACTIVE_NETWORK,
      listing.provider.stellarAddress,
      `agentmarket:${listing.slug}`
    )
  }

  return executeListingRequest(request, listing)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handleRequest(request, params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handleRequest(request, params)
}
