import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim()
  const daysParam = request.nextUrl.searchParams.get('days') ?? '30'

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 })
  }

  const days = parseInt(daysParam, 10)
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 })
  }

  try {
    const prisma = getPrismaClient()

    const provider = await prisma.provider.findUnique({
      where: { stellarAddress: address },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const calls = await prisma.apiCall.findMany({
      where: {
        apiListing: { providerId: provider.id },
        createdAt: { gte: since },
      },
      include: {
        apiListing: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const network = process.env.STELLAR_NETWORK ?? 'testnet'
    const explorerBase =
      network === 'mainnet'
        ? 'https://stellarchain.io/tx/'
        : 'https://testnet.stellarchain.io/tx/'

    // Build per-slug breakdown (successful calls only for earnings)
    const breakdownMap = new Map<string, { calls: number; earningsUsdc: number }>()
    for (const call of calls) {
      const slug = call.apiListing.slug
      const entry = breakdownMap.get(slug) ?? { calls: 0, earningsUsdc: 0 }
      entry.calls++
      if (call.success) {
        entry.earningsUsdc =
          Math.round((entry.earningsUsdc + call.amountUsdc) * 1e6) / 1e6
      }
      breakdownMap.set(slug, entry)
    }

    const breakdown = Array.from(breakdownMap.entries())
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => b.earningsUsdc - a.earningsUsdc)

    const successfulCalls = calls.filter((c) => c.success)
    const totalEarningsUsdc =
      Math.round(
        successfulCalls.reduce((s, c) => s + c.amountUsdc, 0) * 1e6
      ) / 1e6

    return NextResponse.json({
      provider: address,
      generatedAt: new Date().toISOString(),
      periodDays: days,
      totalEarningsUsdc,
      callCount: calls.length,
      successfulCalls: successfulCalls.length,
      breakdown,
      transactions: calls.map((c) => ({
        txHash: c.txHash,
        apiSlug: c.apiListing.slug,
        amountUsdc: c.amountUsdc,
        timestamp: c.createdAt.toISOString(),
        success: c.success,
      })),
      stellarExplorerBase: explorerBase,
    })
  } catch (error) {
    console.error('Earnings proof error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
