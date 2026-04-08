import type { PrismaClient } from '@prisma/client'
import { getCategoryIcon } from '@/lib/marketplace/catalog'

export interface ProviderDashboardApi {
  id: string
  slug: string
  name: string
  icon: string
  description: string
  category: string
  endpoint: string
  method: string
  priceUsdc: number
  totalCalls: number
  revenue: number
  successRate: number
  avgLatencyMs: number
  isActive: boolean
  isFeatured: boolean
  updatedAt: Date
}

export interface ProviderDashboardCall {
  id: string
  apiId: string
  apiName: string
  callerAddress: string
  txHash: string
  amountUsdc: number
  success: boolean
  latencyMs: number | null
  errorMessage: string | null
  createdAt: Date
}

export interface ProviderDashboardData {
  provider: {
    id: string
    name: string
    stellarAddress: string
    email: string | null
    description: string | null
    verified: boolean
    totalEarnings: number
    createdAt: Date
  }
  summary: {
    totalApis: number
    activeApis: number
    totalCalls: number
    totalRevenue: number
    averageRevenuePerCall: number
    successRate: number
    avgLatencyMs: number
  }
  apis: ProviderDashboardApi[]
  recentCalls: ProviderDashboardCall[]
}

export async function getProviderDashboard(
  prisma: PrismaClient,
  stellarAddress: string
): Promise<ProviderDashboardData | null> {
  const provider = await prisma.provider.findUnique({
    where: { stellarAddress },
    include: {
      apiListings: {
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          calls: {
            orderBy: [{ createdAt: 'desc' }],
          },
        },
      },
    },
  })

  if (!provider) {
    return null
  }

  const apis: ProviderDashboardApi[] = provider.apiListings.map((listing) => {
    const revenue = listing.calls.reduce((sum, call) => sum + call.amountUsdc, 0)

    return {
      id: listing.id,
      slug: listing.slug,
      name: listing.name,
      icon: getCategoryIcon(listing.category),
      description: listing.description,
      category: listing.category,
      endpoint: listing.endpoint,
      method: listing.method,
      priceUsdc: listing.priceUsdc,
      totalCalls: listing.totalCalls,
      revenue,
      successRate: listing.successRate,
      avgLatencyMs: listing.avgLatencyMs,
      isActive: listing.isActive,
      isFeatured: listing.isFeatured,
      updatedAt: listing.updatedAt,
    }
  })

  const recentCalls: ProviderDashboardCall[] = provider.apiListings
    .flatMap((listing) =>
      listing.calls.map((call) => ({
        id: call.id,
        apiId: listing.id,
        apiName: listing.name,
        callerAddress: call.callerAddress,
        txHash: call.txHash,
        amountUsdc: call.amountUsdc,
        success: call.success,
        latencyMs: call.latencyMs,
        errorMessage: call.errorMessage,
        createdAt: call.createdAt,
      }))
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 25)

  const totalCalls = apis.reduce((sum, listing) => sum + listing.totalCalls, 0)
  const totalRevenue = apis.reduce((sum, listing) => sum + listing.revenue, 0)
  const totalSuccessfulCalls = apis.reduce(
    (sum, listing) => sum + Math.round((listing.successRate / 100) * listing.totalCalls),
    0
  )
  const weightedLatency = apis.reduce(
    (sum, listing) => sum + listing.avgLatencyMs * listing.totalCalls,
    0
  )

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      stellarAddress: provider.stellarAddress,
      email: provider.email,
      description: provider.description,
      verified: provider.verified,
      totalEarnings: Math.max(provider.totalEarnings, totalRevenue),
      createdAt: provider.createdAt,
    },
    summary: {
      totalApis: apis.length,
      activeApis: apis.filter((listing) => listing.isActive).length,
      totalCalls,
      totalRevenue,
      averageRevenuePerCall: totalCalls > 0 ? totalRevenue / totalCalls : 0,
      successRate: totalCalls > 0 ? (totalSuccessfulCalls / totalCalls) * 100 : 100,
      avgLatencyMs: totalCalls > 0 ? Math.round(weightedLatency / totalCalls) : 0,
    },
    apis,
    recentCalls,
  }
}
