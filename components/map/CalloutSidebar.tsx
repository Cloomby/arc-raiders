'use client'

import { useState, useRef } from 'react'
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
  order: number
  parentId?: string | null
  children?: SidebarCallout[]
}

interface CalloutSidebarProps {
  callouts: SidebarCallout[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onReorder: (items: { id: string; order: number }[]) => void
  canEdit: boolean
  layer: MapLayer
}

function buildTree(callouts: SidebarCallout[]): SidebarCallout[] {
  const sorted = [...callouts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const map = new Map(sorted.map((c) => [c._id, { ...c, children: [] as SidebarCallout[] }]))
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

/** Flatten just one level of siblings for drag-over index resolution */
function getSiblings(
  tree: SidebarCallout[],
  parentId: string | null | undefined
): SidebarCallout[] {
  if (!parentId) return tree
  const walk = (nodes: SidebarCallout[]): SidebarCallout[] | null => {
    for (const n of nodes) {
      if (n._id === parentId) return n.children ?? []
      const found = walk(n.children ?? [])
      if (found) return found
    }
    return null
  }
  return walk(tree) ?? []
}

function CalloutNode({
  callout,
  selectedId,
  onSelect,
  onToggleVisibility,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverId,
  dragOverPos,
  canEdit,
  depth = 0,
}: {
  callout: SidebarCallout
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onDragStart: (id: string, parentId: string | null | undefined) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDrop: (e: React.DragEvent, targetId: string) => void
  dragOverId: string | null
  dragOverPos: 'before' | 'after' | null
  canEdit: boolean
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = callout.children && callout.children.length > 0
  const isSelected = callout._id === selectedId

  return (
    <div>
      {/* Drop indicator — before */}
      {dragOverId === callout._id && dragOverPos === 'before' && (
        <div className="mx-2 h-0.5 rounded bg-amber-400" style={{ marginLeft: `${8 + depth * 14}px` }} />
      )}

      <div
        draggable={canEdit}
        onDragStart={canEdit ? (e) => {
          e.stopPropagation()
          onDragStart(callout._id, callout.parentId)
        } : undefined}
        onDragOver={canEdit ? (e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, callout._id) } : undefined}
        onDrop={canEdit ? (e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, callout._id) } : undefined}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors select-none',
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

      {/* Drop indicator — after */}
      {dragOverId === callout._id && dragOverPos === 'after' && (
        <div className="mx-2 h-0.5 rounded bg-amber-400" style={{ marginLeft: `${8 + depth * 14}px` }} />
      )}

      {expanded && hasChildren &&
        callout.children!.map((child) => (
          <CalloutNode
            key={child._id}
            callout={child}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggleVisibility={onToggleVisibility}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            dragOverId={dragOverId}
            dragOverPos={dragOverPos}
            canEdit={canEdit}
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
  onReorder,
  canEdit,
  layer,
}: CalloutSidebarProps) {
  const layerCallouts = callouts.filter((c) => c.layer === layer)
  const tree = buildTree(layerCallouts)

  const dragIdRef = useRef<string | null>(null)
  const dragParentIdRef = useRef<string | null | undefined>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after' | null>(null)

  const handleDragStart = (id: string, parentId: string | null | undefined) => {
    dragIdRef.current = id
    dragParentIdRef.current = parentId
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (dragIdRef.current === targetId) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'before' : 'after'
    setDragOverId(targetId)
    setDragOverPos(pos)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null)
      setDragOverPos(null)
      return
    }

    // Find the target's parent to get the right sibling list
    const findParentId = (nodes: SidebarCallout[], childId: string): string | null => {
      for (const n of nodes) {
        if (n.children?.some((c) => c._id === childId)) return n._id
        const found = findParentId(n.children ?? [], childId)
        if (found !== null) return found
      }
      return null
    }
    const targetParentId = findParentId(tree, targetId)
    const siblings = getSiblings(tree, targetParentId)

    // Remove source from its current position (might be in a different level)
    const filtered = siblings.filter((c) => c._id !== sourceId)
    const targetIdx = filtered.findIndex((c) => c._id === targetId)
    const insertIdx = dragOverPos === 'before' ? targetIdx : targetIdx + 1
    const source = layerCallouts.find((c) => c._id === sourceId)
    if (!source) {
      setDragOverId(null)
      setDragOverPos(null)
      return
    }
    filtered.splice(insertIdx, 0, source)

    // Assign new integer orders to these siblings
    const reorderItems = filtered.map((c, i) => ({ id: c._id, order: i }))
    onReorder(reorderItems)

    setDragOverId(null)
    setDragOverPos(null)
    dragIdRef.current = null
  }

  const handleDragEnd = () => {
    setDragOverId(null)
    setDragOverPos(null)
    dragIdRef.current = null
  }

  return (
    <div
      className="flex h-full flex-col border-r border-zinc-700 bg-zinc-900/80"
      onDragEnd={handleDragEnd}
    >
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
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                dragOverId={dragOverId}
                dragOverPos={dragOverPos}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
