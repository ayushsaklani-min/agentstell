import { NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'
import {
  getFallbackCatalog,
  mapDbListing,
  summarizeMarketplace,
} from '@/lib/marketplace/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const prisma = getPrismaClient()
    const listings = await prisma.apiListing.findMany({
      where: { isActive: true },
      include: {
        provider: {
          select: {
            name: true,
            stellarAddress: true,
          },
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { totalCalls: 'desc' },
      ],
    })

    const dbApis = listings.map(mapDbListing)
    const dbSlugs = new Set(dbApis.map((a) => a.slug))

    // Merge fallback catalog entries that aren't already in the DB
    const fallbackExtras = getFallbackCatalog().filter((a) => !dbSlugs.has(a.slug))
    const apis = [...dbApis, ...fallbackExtras]

    return NextResponse.json({
      apis,
      stats: summarizeMarketplace(apis),
      source: listings.length > 0 ? 'database+fallback' : 'fallback',
    })
  } catch (error) {
    console.error('Failed to load marketplace from database:', error)
  }

  const apis = getFallbackCatalog()
  return NextResponse.json({
    apis,
    stats: summarizeMarketplace(apis),
    source: 'fallback',
  })
}
