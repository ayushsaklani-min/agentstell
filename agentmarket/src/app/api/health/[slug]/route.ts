import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutes
const TIMEOUT_MS   = 3000             // 3 seconds

type HealthStatus = 'healthy' | 'degraded' | 'down'

function classify(ok: boolean, latencyMs: number): HealthStatus {
  if (!ok) return 'down'
  if (latencyMs >= 1000) return 'degraded'
  return 'healthy'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const prisma = getPrismaClient()
    const listing = await prisma.apiListing.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        endpoint: true,
        healthStatus: true,
        healthCheckedAt: true,
        healthLatencyMs: true,
      },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Return cached result if fresh
    if (
      listing.healthCheckedAt &&
      listing.healthStatus &&
      Date.now() - listing.healthCheckedAt.getTime() < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        slug,
        status: listing.healthStatus,
        latencyMs: listing.healthLatencyMs,
        checkedAt: listing.healthCheckedAt.toISOString(),
        cached: true,
      })
    }

    // Live ping
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const startedAt = Date.now()

    let ok = false
    let latencyMs = TIMEOUT_MS

    try {
      const response = await fetch(listing.endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      latencyMs = Date.now() - startedAt
      ok = response.ok
    } catch {
      latencyMs = Date.now() - startedAt
      ok = false
    } finally {
      clearTimeout(timeoutId)
    }

    const status: HealthStatus = classify(ok, latencyMs)
    const checkedAt = new Date()

    // Write result back to DB (best-effort — don't fail the response if write fails)
    try {
      await prisma.apiListing.update({
        where: { id: listing.id },
        data: {
          healthStatus: status,
          healthCheckedAt: checkedAt,
          healthLatencyMs: latencyMs,
        },
      })
    } catch (writeError) {
      console.error('Health check DB write failed:', writeError)
    }

    return NextResponse.json({
      slug,
      status,
      latencyMs,
      checkedAt: checkedAt.toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
