import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'
import { UpdateCalloutSchema } from '@/schemas/callout'
import mongoose from 'mongoose'

type Params = { params: Promise<{ id: string }> }

// GET /api/callouts/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await connectDB()
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session

    const query = Callout.findOne({ _id: id, deletedAt: null })
    if (!isAuthenticated) query.select('-comments -auditLog')
    const callout = await query.lean()

    if (!callout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(callout)
  } catch (error) {
    console.error('GET /api/callouts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/callouts/[id] - contributor+
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'reader') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = UpdateCalloutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
    }

    await connectDB()
    const callout = await Callout.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        ...parsed.data,
        $push: {
          auditLog: {
            userId: session.user.discordId,
            username: session.user.name ?? 'Unknown',
            action: 'updated',
          },
        },
      },
      { returnDocument: 'after' }
    )

    if (!callout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(callout)
  } catch (error) {
    console.error('PUT /api/callouts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/callouts/[id] - contributor+ (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'reader') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await connectDB()
    const callout = await Callout.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        deletedAt: new Date(),
        $push: {
          auditLog: {
            userId: session.user.discordId,
            username: session.user.name ?? 'Unknown',
            action: 'deleted',
          },
        },
      },
      { returnDocument: 'after' }
    )

    if (!callout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/callouts/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
