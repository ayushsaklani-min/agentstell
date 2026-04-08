import type { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'
import { mapDbListing } from '@/lib/marketplace/catalog'

interface ProviderRegistrationRequest {
  providerName: string
  email?: string
  providerDescription?: string
  stellarAddress: string
  apiName: string
  description: string
  longDescription?: string
  endpoint: string
  category: string
  priceUsdc: number
  method?: string
}

const RESERVED_SLUGS = new Set([
  'weather',
  'air-quality',
  'news',
  'currency',
  'geolocation',
  'ai',
  'agent-test',
])

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCategory(category: string) {
  const normalized = category.trim().toUpperCase()

  if (['DATA', 'FINANCE', 'GEO', 'AI', 'UTILITIES', 'NEWS', 'WEATHER'].includes(normalized)) {
    return normalized
  }

  return 'UTILITIES'
}

async function buildUniqueSlug(prisma: PrismaClient, baseSlug: string) {
  let candidate = baseSlug || 'api'
  let suffix = 1

  while (
    RESERVED_SLUGS.has(candidate) ||
    await prisma.apiListing.findUnique({ where: { slug: candidate } })
  ) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidate
}

function normalizeMethod(method?: string) {
  const normalized = method?.trim().toUpperCase() || 'GET'
  return normalized === 'POST' ? 'POST' : 'GET'
}

function isAllowedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)

    if (url.protocol === 'https:') {
      return true
    }

    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient()
    const body = await request.json() as ProviderRegistrationRequest

    const {
      providerName,
      email,
      providerDescription,
      stellarAddress,
      apiName,
      description,
      longDescription,
      endpoint,
      category,
      priceUsdc,
      method,
    } = body

    if (
      !providerName ||
      !stellarAddress ||
      !apiName ||
      !description ||
      !endpoint ||
      !category ||
      !priceUsdc
    ) {
      return NextResponse.json(
        { error: 'Missing required registration fields' },
        { status: 400 }
      )
    }

    if (priceUsdc <= 0) {
      return NextResponse.json(
        { error: 'priceUsdc must be greater than zero' },
        { status: 400 }
      )
    }

    if (!isAllowedEndpoint(endpoint)) {
      return NextResponse.json(
        {
          error:
            'Endpoint must be HTTPS, or HTTP on localhost/127.0.0.1 for local testing',
        },
        { status: 400 }
      )
    }

    const provider = await prisma.provider.upsert({
      where: { stellarAddress },
      update: {
        name: providerName,
        email,
        description: providerDescription,
      },
      create: {
        name: providerName,
        email,
        stellarAddress,
        description: providerDescription,
      },
    })

    const slug = await buildUniqueSlug(prisma, slugify(apiName))

    const listing = await prisma.apiListing.create({
      data: {
        name: apiName,
        slug,
        description,
        longDescription: longDescription || description,
        category: normalizeCategory(category),
        priceUsdc,
        endpoint,
        method: normalizeMethod(method),
        providerId: provider.id,
        isActive: true,
        isFeatured: false,
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

    return NextResponse.json({
      success: true,
      api: mapDbListing(listing),
    })
  } catch (error) {
    console.error('Provider registration failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Provider registration failed',
      },
      { status: 500 }
    )
  }
}
