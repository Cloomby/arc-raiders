'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '@/components/NavBar'
import { CalloutSidebar } from '@/components/map/CalloutSidebar'
import { DrawingToolbar } from '@/components/map/DrawingToolbar'
import { CalloutPopup } from '@/components/map/CalloutPopup'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COLOR_PRESETS } from '@/lib/utils'
import type { DrawingMode, MapLayer } from '@/lib/utils'
import type { IGeometry, IComment, IAuditEntry } from '@/models/Callout'

// react-konva must be loaded client-side only
const CalloutCanvas = dynamic(
  () => import('@/components/map/CalloutCanvas').then((m) => m.CalloutCanvas),
  { ssr: false }
)

// Plain data type (not Mongoose Document) for TanStack Query cache
interface CalloutDoc {
  _id: string
  name: string
  layer: string
  geometry: IGeometry
  color: string
  visible: boolean
  order: number
  parentId?: string | null
  comments?: IComment[]
  auditLog?: IAuditEntry[]
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

interface NewCalloutForm {
  name: string
  color: string
  parentId: string
}

export default function MapPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const canEdit = session?.user.role === 'admin' || session?.user.role === 'contributor'
  const canComment = canEdit

  const [layer, setLayer] = useState<MapLayer>('top')
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Pending geometry waiting for name/color dialog
  const pendingGeometry = useRef<object | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newForm, setNewForm] = useState<NewCalloutForm>({
    name: '',
    color: '#FFD700',
    parentId: '',
  })

  // Fetch callouts — polling every 3s for near-real-time updates
  const { data: callouts = [] } = useQuery<CalloutDoc[]>({
    queryKey: ['callouts'],
    queryFn: async () => {
      const res = await fetch('/api/callouts')
      if (!res.ok) throw new Error('Failed to fetch callouts')
      return res.json()
    },
    refetchInterval: 3000,
  })

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch('/api/callouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create callout')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['callouts'] })
      setSelectedId(data._id)
    },
  })

  const updateGeometryMutation = useMutation({
    mutationFn: async ({ id, geometry }: { id: string; geometry: object }) => {
      const res = await fetch(`/api/callouts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry }),
      })
      if (!res.ok) throw new Error('Failed to update callout')
      return res.json()
    },
    onMutate: async ({ id, geometry }) => {
      await queryClient.cancelQueries({ queryKey: ['callouts'] })
      const previous = queryClient.getQueryData<CalloutDoc[]>(['callouts'])
      queryClient.setQueryData<CalloutDoc[]>(['callouts'], (old = []) =>
        old.map((c) => (c._id === id ? { ...c, geometry: geometry as CalloutDoc['geometry'] } : c))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['callouts'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['callouts'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/callouts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete callout')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callouts'] })
      setSelectedId(null)
    },
  })

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const res = await fetch(`/api/callouts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      })
      if (!res.ok) throw new Error('Failed to update visibility')
    },
    onMutate: async ({ id, visible }) => {
      await queryClient.cancelQueries({ queryKey: ['callouts'] })
      const previous = queryClient.getQueryData<CalloutDoc[]>(['callouts'])
      queryClient.setQueryData<CalloutDoc[]>(['callouts'], (old = []) =>
        old.map((c) => (c._id === id ? { ...c, visible } : c))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['callouts'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['callouts'] }),
  })

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      const res = await fetch('/api/callouts/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      })
      if (!res.ok) throw new Error('Failed to reorder callouts')
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['callouts'] })
      const previous = queryClient.getQueryData<CalloutDoc[]>(['callouts'])
      const orderMap = new Map(items.map((i) => [i.id, i.order]))
      queryClient.setQueryData<CalloutDoc[]>(['callouts'], (old = []) =>
        old.map((c) => orderMap.has(c._id) ? { ...c, order: orderMap.get(c._id)! } : c)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['callouts'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['callouts'] }),
  })

  // When canvas finishes drawing a shape, prompt user to name it
  const handleCreateCallout = useCallback(
    (geometry: object) => {
      pendingGeometry.current = geometry
      setNewForm({ name: '', color: '#FFD700', parentId: '' })
      setShowCreateDialog(true)
      setDrawingMode('select')
    },
    []
  )

  const handleConfirmCreate = useCallback(() => {
    if (!pendingGeometry.current || !newForm.name.trim()) return
    createMutation.mutate({
      name: newForm.name.trim(),
      layer,
      geometry: pendingGeometry.current,
      color: newForm.color,
      parentId: newForm.parentId || null,
    })
    setShowCreateDialog(false)
    pendingGeometry.current = null
  }, [createMutation, newForm, layer])

  const handleUpdateGeometry = useCallback(
    (id: string, geometry: object) => {
      updateGeometryMutation.mutate({ id, geometry })
    },
    [updateGeometryMutation]
  )

  const handleJumpTo = useCallback(
    (id: string) => {
      const callout = callouts.find((c) => c._id === id)
      if (!callout) return
      if (callout.layer !== layer) setLayer(callout.layer as MapLayer)
      setSelectedId(id)
      setHighlightId(id)
      setTimeout(() => setHighlightId(null), 2000)
    },
    [callouts, layer]
  )

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const callout = callouts.find((c) => c._id === id)
      if (!callout) return
      toggleVisibilityMutation.mutate({ id, visible: !callout.visible })
    },
    [callouts, toggleVisibilityMutation]
  )

  const handleReorder = useCallback(
    (items: { id: string; order: number }[]) => {
      reorderMutation.mutate(items)
    },
    [reorderMutation]
  )

  const selectedCallout = selectedId ? callouts.find((c) => c._id === selectedId) : null
  const topCount = callouts.filter((c) => c.layer === 'top').length
  const bottomCount = callouts.filter((c) => c.layer === 'bottom').length

  // Sort by order so the canvas renders in a stable z-order
  const sortedCallouts = [...callouts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const canvasCallouts = sortedCallouts.filter((c) => c.layer === layer).map((c) => ({
    _id: c._id,
    name: c.name,
    layer: c.layer as MapLayer,
    geometry: c.geometry,
    color: c.color,
    visible: c.visible,
  }))

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <NavBar
        callouts={callouts.map((c) => ({ _id: c._id, name: c.name, layer: c.layer }))}
        onJumpTo={handleJumpTo}
        layer={layer}
        onLayerChange={setLayer}
        topCount={topCount}
        bottomCount={bottomCount}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Callout tree */}
        <div className="w-52 shrink-0 overflow-hidden">
          <CalloutSidebar
            callouts={sortedCallouts.map((c) => ({
              _id: c._id,
              name: c.name,
              layer: c.layer as MapLayer,
              color: c.color,
              visible: c.visible,
              order: c.order ?? 0,
              parentId: c.parentId?.toString() ?? null,
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleVisibility={handleToggleVisibility}
            onReorder={handleReorder}
            canEdit={canEdit}
            layer={layer}
          />
        </div>

        {/* Center: Map canvas */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Drawing toolbar overlay */}
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            {canEdit && (
              <DrawingToolbar
                mode={drawingMode}
                onModeChange={setDrawingMode}
                canEdit={canEdit}
                selectedId={selectedId}
                onDeleteSelected={() => selectedId && deleteMutation.mutate(selectedId)}
                onToggleVisibility={() => selectedId && handleToggleVisibility(selectedId)}
                selectedVisible={selectedCallout?.visible}
              />
            )}
          </div>

          <CalloutCanvas
            layer={layer}
            callouts={canvasCallouts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mode={drawingMode}
            onModeChange={setDrawingMode}
            canEdit={canEdit}
            onCreateCallout={handleCreateCallout}
            onUpdateGeometry={handleUpdateGeometry}
            highlightId={highlightId}
          />
        </div>

        {/* Right: Callout details */}
        {selectedCallout && (
          <div className="w-72 shrink-0 overflow-hidden">
            <CalloutPopup
              callout={selectedCallout}
              allCallouts={callouts.map((c) => ({
                _id: c._id,
                name: c.name,
                layer: c.layer,
                parentId: c.parentId ?? null,
              }))}
              onClose={() => setSelectedId(null)}
              canEdit={canEdit}
              canComment={canComment}
            />
          </div>
        )}
      </div>

      {/* Create callout dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Name this callout</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Input
              placeholder="e.g. Server Room, Rooftop Entry..."
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCreate() }}
              autoFocus
            />

            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  title={preset.name}
                  onClick={() => setNewForm((f) => ({ ...f, color: preset.color }))}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: preset.color,
                    borderColor: newForm.color === preset.color ? '#fff' : 'transparent',
                  }}
                />
              ))}
              <input
                type="color"
                value={newForm.color}
                onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))}
                className="h-7 w-7 cursor-pointer rounded-full border-2 border-zinc-600 bg-transparent p-0"
                title="Custom color"
              />
            </div>

            {/* Parent callout selector */}
            {callouts.filter((c) => c.layer === layer).length > 0 && (
              <Select
                value={newForm.parentId || 'none'}
                onValueChange={(v) => setNewForm((f) => ({ ...f, parentId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Parent callout (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {callouts
                    .filter((c) => c.layer === layer)
                    .map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  pendingGeometry.current = null
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!newForm.name.trim() || createMutation.isPending}
                onClick={handleConfirmCreate}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
