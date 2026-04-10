import { NextResponse } from 'next/server'
import { getFallbackCatalog, mapDbListing } from '@/lib/marketplace/catalog'
import type { MarketplaceListing, MarketplaceParam } from '@/lib/marketplace/catalog'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface AgentEntry {
  slug: string
  entityType: 'api' | 'agent'
  name: string
  description: string
  category: string
  price: { amount: number; asset: string }
  endpoint: string
  method: 'GET' | 'POST'
  input: {
    params: MarketplaceParam[]
    schema: Record<string, unknown> | null
    example: Record<string, unknown>
  }
  output: {
    schema: Record<string, unknown> | null
    example: Record<string, unknown>
  }
  reliability: {
    sideEffects: string
    latency: string
    idempotent: boolean
    successRate: number
  }
  provider: {
    name: string
    stellarAddress: string
  }
}

function toAgentEntry(listing: MarketplaceListing): AgentEntry {
  const spec = listing.capabilitySpec
  return {
    slug: listing.slug,
    entityType: listing.category === 'Agent' ? 'agent' : 'api',
    name: listing.name,
    description: listing.description,
    category: listing.category,
    price: { amount: listing.priceUsdc, asset: 'USDC' },
    endpoint: listing.endpoint,
    method: listing.method,
    input: {
      params: spec.params,
      schema: spec.requestSchema,
      example: spec.exampleRequest,
    },
    output: {
      schema: spec.responseSchema,
      example: spec.exampleResponse,
    },
    reliability: {
      sideEffects: spec.sideEffectLevel,
      latency: spec.latencyHint,
      idempotent: spec.idempotent,
      successRate: listing.successRate,
    },
    provider: {
      name: listing.providerName,
      stellarAddress: listing.providerStellarAddress,
    },
  }
}

export async function GET() {
  const network = process.env.STELLAR_NETWORK ?? 'testnet'
  const marketplace = process.env.AGENTMARKET_BASE_URL ?? 'https://agentmarket.xyz'

  let listings: MarketplaceListing[] = []

  try {
    const prisma = getPrismaClient()
    const rows = await prisma.apiListing.findMany({
      where: { isActive: true },
      include: { provider: { select: { name: true, stellarAddress: true } } },
      orderBy: [{ isFeatured: 'desc' }, { totalCalls: 'desc' }],
    })
    if (rows.length > 0) {
      listings = rows.map(mapDbListing)
    }
  } catch {
    // DB unavailable — fall through to catalog
  }

  if (listings.length === 0) {
    listings = getFallbackCatalog()
  }

  const apis = listings.map(toAgentEntry)

  return NextResponse.json({
    version: '1',
    marketplace,
    paymentProtocol: 'x402',
    paymentNetwork: network,
    paymentAsset: 'USDC',
    total: apis.length,
    apis,
  })
}
