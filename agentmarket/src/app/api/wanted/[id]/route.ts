import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['open', 'fulfilled', 'closed'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { status, posterAddress } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!posterAddress || typeof posterAddress !== 'string') {
      return NextResponse.json({ error: 'posterAddress is required' }, { status: 400 })
    }

    const prisma = getPrismaClient()
    const post = await prisma.wantedPost.findUnique({ where: { id } })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.posterAddress !== posterAddress) {
      return NextResponse.json(
        { error: 'Not authorised to update this post' },
        { status: 403 }
      )
    }

    const updated = await prisma.wantedPost.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Wanted PATCH error:', error)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
