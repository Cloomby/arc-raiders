import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ROLE_MAP } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/users - admin only, returns current role map
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = Object.entries(ROLE_MAP).map(([discordId, role]) => ({
    discordId,
    role,
  }))

  return NextResponse.json(users)
}
