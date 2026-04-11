import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STELLAR_ADDRESS_RE = /^G[A-Z0-9]{55}$/

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? 'open'
  const category = request.nextUrl.searchParams.get('category')?.trim()

  try {
    const prisma = getPrismaClient()
    const posts = await prisma.wantedPost.findMany({
      where: {
        ...(status !== 'all' ? { status } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error('Wanted GET error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, category, budgetUsdc, posterAddress } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (title.trim().length > 120) {
      return NextResponse.json({ error: 'title must be 120 characters or fewer' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (description.trim().length > 1000) {
      return NextResponse.json({ error: 'description must be 1000 characters or fewer' }, { status: 400 })
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }
    if (typeof budgetUsdc !== 'number' || budgetUsdc <= 0) {
      return NextResponse.json({ error: 'budgetUsdc must be greater than 0' }, { status: 400 })
    }
    if (!posterAddress || !STELLAR_ADDRESS_RE.test(posterAddress)) {
      return NextResponse.json(
        { error: 'posterAddress must be a valid Stellar public key' },
        { status: 400 }
      )
    }

    const prisma = getPrismaClient()
    const post = await prisma.wantedPost.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        budgetUsdc,
        posterAddress,
      },
    })

    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error('Wanted POST error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
