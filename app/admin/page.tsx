import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UserManagement } from '@/components/admin/UserManagement'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import { connectDB } from '@/lib/mongodb'
import Callout from '@/models/Callout'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  await connectDB()
  const totalCallouts = await Callout.countDocuments({ deletedAt: null })
  const deletedCallouts = await Callout.countDocuments({ deletedAt: { $ne: null } })
  const topLayerCount = await Callout.countDocuments({ layer: 'top', deletedAt: null })
  const bottomLayerCount = await Callout.countDocuments({ layer: 'bottom', deletedAt: null })

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Map
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-purple-400" />
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Callouts', value: totalCallouts },
            { label: 'Top Layer', value: topLayerCount },
            { label: 'Bottom Layer', value: bottomLayerCount },
            { label: 'Soft Deleted', value: deletedCallouts },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <UserManagement />

        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-200">Signed in as</h2>
          <p className="text-sm text-zinc-400">{session.user.name}</p>
          <p className="font-mono text-xs text-zinc-600">Discord: {session.user.discordId}</p>
        </div>
      </div>
    </div>
  )
}
