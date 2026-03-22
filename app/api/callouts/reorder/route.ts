import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'
import mongoose from 'mongoose'
import { z } from 'zod'

const ReorderSchema = z.array(
  z.object({
    id: z.string(),
    order: z.number(),
  })
)

// POST /api/callouts/reorder — bulk update display order
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'reader') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = ReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
    }

    await connectDB()

    const validIds = parsed.data.filter((item) => mongoose.isValidObjectId(item.id))
    await Promise.all(
      validIds.map(({ id, order }) =>
        Callout.updateOne({ _id: id, deletedAt: null }, { order })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/callouts/reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
