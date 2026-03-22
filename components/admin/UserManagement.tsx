'use client'

import { Shield, User, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ROLE_MAP } from '@/lib/utils'

export function UserManagement() {
  const users = Object.entries(ROLE_MAP).map(([discordId, role]) => ({ discordId, role }))

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900">
      <div className="border-b border-zinc-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Role Management</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Roles are defined in <code className="rounded bg-zinc-800 px-1">lib/utils.ts</code>.
          Redeploy to apply changes.
        </p>
      </div>
      <div className="divide-y divide-zinc-800">
        {users.map(({ discordId, role }) => (
          <div key={discordId} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800">
              {role === 'admin' ? (
                <Shield className="h-4 w-4 text-purple-400" />
              ) : role === 'contributor' ? (
                <User className="h-4 w-4 text-blue-400" />
              ) : (
                <Eye className="h-4 w-4 text-zinc-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-mono text-zinc-300">{discordId}</p>
              <p className="text-xs text-zinc-600">Discord ID</p>
            </div>
            <Badge variant={role as 'admin' | 'contributor' | 'reader'}>{role}</Badge>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-700 px-4 py-3">
        <p className="text-xs text-zinc-600">
          All other Discord users are assigned the <strong>reader</strong> role automatically.
        </p>
      </div>
    </div>
  )
}
