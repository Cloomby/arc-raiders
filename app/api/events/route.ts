// Lightweight polling endpoint — returns the most recent callout updatedAt timestamp.
// Clients use TanStack Query refetchInterval to poll this and invalidate callouts when changed.
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    const latest = await Callout.findOne({ deletedAt: null })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean()

    return NextResponse.json({
      lastModified: latest?.updatedAt ?? null,
      ts: Date.now(),
    })
  } catch {
    return NextResponse.json({ lastModified: null, ts: Date.now() })
  }
}
