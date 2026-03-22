'use client'

import { useState } from 'react'
import { X, Edit2, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CommentThread } from './CommentThread'
import { COLOR_PRESETS } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { IComment, IAuditEntry, IGeometry } from '@/models/Callout'

interface CalloutData {
  _id: string
  name: string
  layer: string
  geometry: IGeometry
  color: string
  visible: boolean
  comments?: IComment[]
  auditLog?: IAuditEntry[]
}

interface CalloutPopupProps {
  callout: CalloutData
  onClose: () => void
  canEdit: boolean
  canComment: boolean
}

export function CalloutPopup({ callout, onClose, canEdit, canComment }: CalloutPopupProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(callout.name)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<CalloutData>) => {
      const res = await fetch(`/api/callouts/${callout._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['callouts'] }),
  })

  const saveName = () => {
    if (nameInput.trim() && nameInput !== callout.name) {
      updateMutation.mutate({ name: nameInput.trim() })
    }
    setEditingName(false)
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-700 bg-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-700 p-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-1">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
                className="h-7 text-sm"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveName}>
                <Check className="h-3.5 w-3.5 text-green-400" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                style={{ background: callout.color }}
              />
              <h3 className="truncate text-sm font-semibold text-zinc-100">{callout.name}</h3>
              {canEdit && (
                <button
                  onClick={() => setEditingName(true)}
                  className="shrink-0 text-zinc-500 hover:text-zinc-300"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="default" className="text-xs capitalize">
              {callout.layer} layer
            </Badge>
            <Badge variant="default" className="text-xs capitalize">
              {callout.geometry.type}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* Color picker */}
          {canEdit && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Color
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    title={preset.name}
                    onClick={() => updateMutation.mutate({ color: preset.color })}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: preset.color,
                      borderColor: callout.color === preset.color ? '#fff' : 'transparent',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={callout.color}
                  onChange={(e) => updateMutation.mutate({ color: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded-full border-2 border-zinc-600 bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>
          )}

          {/* Audit log */}
          {callout.auditLog && callout.auditLog.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> History
              </span>
              <div className="flex flex-col gap-0.5 text-xs text-zinc-500">
                {callout.auditLog
                  .slice(-5)
                  .reverse()
                  .map((entry, i) => (
                    <div key={i}>
                      <span className="text-zinc-400">{entry.username}</span> {entry.action}{' '}
                      <span className="text-zinc-600">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <CommentThread
            calloutId={callout._id.toString()}
            comments={callout.comments ?? []}
            canComment={canComment}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
