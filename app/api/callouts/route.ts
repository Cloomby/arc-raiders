import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'
import { CreateCalloutSchema } from '@/schemas/callout'

export const dynamic = 'force-dynamic'

// GET /api/callouts - public, returns all non-deleted callouts
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const layer = searchParams.get('layer')

    const query: Record<string, unknown> = { deletedAt: null }
    if (layer === 'top' || layer === 'bottom') query.layer = layer

    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session

    const dbQuery = Callout.find(query).sort({ createdAt: -1 })
    if (!isAuthenticated) dbQuery.select('-comments -auditLog')
    const callouts = await dbQuery.lean()

    return NextResponse.json(callouts)
  } catch (error) {
    console.error('GET /api/callouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/callouts - contributor+ only
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'reader') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = CreateCalloutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
    }

    await connectDB()
    const callout = await Callout.create({
      ...parsed.data,
      createdBy: session.user.discordId,
      createdByName: session.user.name ?? 'Unknown',
      auditLog: [
        {
          userId: session.user.discordId,
          username: session.user.name ?? 'Unknown',
          action: 'created',
        },
      ],
    })

    return NextResponse.json(callout, { status: 201 })
  } catch (error) {
    console.error('POST /api/callouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
