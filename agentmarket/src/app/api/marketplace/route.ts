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

    if (listings.length > 0) {
      const apis = listings.map(mapDbListing)
      return NextResponse.json({
        apis,
        stats: summarizeMarketplace(apis),
        source: 'database',
      })
    }
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
