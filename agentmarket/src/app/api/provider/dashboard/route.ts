import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'
import { getProviderDashboard } from '@/lib/provider/dashboard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const stellarAddress = request.nextUrl.searchParams.get('stellarAddress')?.trim()

  if (!stellarAddress) {
    return NextResponse.json(
      { error: 'stellarAddress query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const prisma = getPrismaClient()
    const dashboard = await getProviderDashboard(prisma, stellarAddress)

    if (!dashboard) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dashboard)
  } catch (error) {
    console.error(`Failed to load provider dashboard for ${stellarAddress}:`, error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load provider dashboard',
      },
      { status: 500 }
    )
  }
}
