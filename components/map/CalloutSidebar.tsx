'use client'

import { useState } from 'react'
import { Eye, EyeOff, ChevronRight, ChevronDown, MapPin } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { MapLayer } from '@/lib/utils'

interface SidebarCallout {
  _id: string
  name: string
  layer: MapLayer
  color: string
  visible: boolean
  parentId?: string | null
  children?: SidebarCallout[]
}

interface CalloutSidebarProps {
  callouts: SidebarCallout[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  layer: MapLayer
}

function buildTree(callouts: SidebarCallout[]): SidebarCallout[] {
  const map = new Map(callouts.map((c) => [c._id, { ...c, children: [] as SidebarCallout[] }]))
  const roots: SidebarCallout[] = []
  map.forEach((c) => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children!.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

function CalloutNode({
  callout,
  selectedId,
  onSelect,
  onToggleVisibility,
  depth = 0,
}: {
  callout: SidebarCallout
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = callout.children && callout.children.length > 0
  const isSelected = callout._id === selectedId

  return (
    <div>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors',
          isSelected ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
          !callout.visible && 'opacity-50'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(callout._id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            className="shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </button>
        ) : (
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: callout.color }} />
        )}

        <span className="flex-1 truncate text-xs">{callout.name}</span>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(callout._id) }}
          className="shrink-0 text-zinc-600 opacity-0 hover:text-zinc-300 group-hover:opacity-100"
        >
          {callout.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && hasChildren &&
        callout.children!.map((child) => (
          <CalloutNode
            key={child._id}
            callout={child}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggleVisibility={onToggleVisibility}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export function CalloutSidebar({
  callouts,
  selectedId,
  onSelect,
  onToggleVisibility,
  layer,
}: CalloutSidebarProps) {
  const layerCallouts = callouts.filter((c) => c.layer === layer)
  const tree = buildTree(layerCallouts)

  return (
    <div className="flex h-full flex-col border-r border-zinc-700 bg-zinc-900/80">
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Callouts
        </span>
        <span className="text-xs text-zinc-600">{layerCallouts.length}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {tree.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-600">
              No callouts on this layer yet.
            </p>
          ) : (
            tree.map((c) => (
              <CalloutNode
                key={c._id}
                callout={c}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggleVisibility={onToggleVisibility}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
