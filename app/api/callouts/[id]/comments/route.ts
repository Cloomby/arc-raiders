import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'
import { CreateCommentSchema } from '@/schemas/callout'
import mongoose from 'mongoose'

type Params = { params: Promise<{ id: string }> }

// POST /api/callouts/[id]/comments - contributor+
export async function POST(req: NextRequest, { params }: Params) {
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
    const parsed = CreateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
    }

    await connectDB()

    const newComment = {
      userId: session.user.discordId,
      username: session.user.name ?? 'Unknown',
      avatarUrl: session.user.image ?? undefined,
      text: parsed.data.text,
      createdAt: new Date(),
      replies: [],
    }

    // If replying to a comment, push into that comment's replies
    if (parsed.data.parentCommentId) {
      const callout = await Callout.findOneAndUpdate(
        { _id: id, deletedAt: null, 'comments._id': parsed.data.parentCommentId },
        { $push: { 'comments.$.replies': newComment } },
        { returnDocument: 'after' }
      )
      if (!callout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(callout.comments)
    }

    const callout = await Callout.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $push: { comments: newComment } },
      { new: true }
    )

    if (!callout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(callout.comments, { status: 201 })
  } catch (error) {
    console.error('POST /api/callouts/[id]/comments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
