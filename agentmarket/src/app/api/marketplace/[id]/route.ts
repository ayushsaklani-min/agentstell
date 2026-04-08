import { NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'
import { getFallbackListing, mapDbListing } from '@/lib/marketplace/catalog'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const prisma = getPrismaClient()
    const listing = await prisma.apiListing.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        provider: {
          select: {
            name: true,
            stellarAddress: true,
          },
        },
      },
    })

    if (listing) {
      return NextResponse.json({
        api: mapDbListing(listing),
        source: 'database',
      })
    }
  } catch (error) {
    console.error(`Failed to load marketplace listing ${id}:`, error)
  }

  const fallback = getFallbackListing(id)
  if (fallback) {
    return NextResponse.json({
      api: fallback,
      source: 'fallback',
    })
  }

  return NextResponse.json(
    { error: 'API not found' },
    { status: 404 }
  )
}
