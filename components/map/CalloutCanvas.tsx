'use client'

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Line, Text, Transformer, Group, Circle } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import type { DrawingMode, MapLayer } from '@/lib/utils'

interface Geometry {
  type: 'rectangle' | 'polygon'
  x?: number
  y?: number
  width?: number
  height?: number
  points?: number[]
  rotation: number
}

export interface CalloutShape {
  _id: string
  name: string
  layer: MapLayer
  geometry: Geometry
  color: string
  visible: boolean
}

interface CalloutCanvasProps {
  layer: MapLayer
  callouts: CalloutShape[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  mode: DrawingMode
  canEdit: boolean
  onCreateCallout: (geometry: Geometry) => void
  onUpdateGeometry: (id: string, geometry: Geometry) => void
  highlightId?: string | null
}

const MAP_IMAGES: Record<MapLayer, string> = {
  top: '/maps/top-layer.png',
  bottom: '/maps/bottom-layer.png',
}

const MIN_DRAW_SIZE = 0.005
const ZOOM_SPEED = 1.1
const MIN_ZOOM_FACTOR = 0.5
const MAX_ZOOM_FACTOR = 20
const ZOOM_TO_CALLOUT_SCALE = 3
/** Apparent radius in screen pixels for vertex/drawing handles */
const HANDLE_RADIUS = 6
/** Screen-pixel threshold for "click near first point" to close polygon */
const CLOSE_THRESHOLD = HANDLE_RADIUS * 2.5
/** Degrees to snap to when Shift is held */
const SNAP_DEGREES = 15
/** Snap zone around a vertex (screen pixels) for cardinal vertex alignment */
const VERTEX_SNAP_PX = 12

/**
 * Full polygon point snap with Shift held:
 *   1. 15° angle snap from (fromN) to cursor (rawN)
 *   2. If the snapped angle is exactly cardinal (0/90/180/270°), also check whether
 *      any existing polyPoint lies on the same cardinal axis from fromN and is within
 *      the snap zone — if so, lock onto that vertex instead.
 *
 * Returns the snapped position plus a flag indicating vertex snap was active
 * (for distinct visual feedback).
 */
function snapPolygonPoint(
  fromNx: number, fromNy: number,
  rawNx: number, rawNy: number,
  polyPoints: number[],
  imageW: number, imageH: number,
  vpScale: number,
): { x: number; y: number; hasVertexSnap: boolean } {
  const fromPx = fromNx * imageW, fromPy = fromNy * imageH
  const rawPx  = rawNx  * imageW, rawPy  = rawNy  * imageH
  const dx = rawPx - fromPx, dy = rawPy - fromPy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) return { x: rawNx, y: rawNy, hasVertexSnap: false }

  // ── Step 1: 15° angle snap ───────────────────────────────────────────────
  const snapRad = SNAP_DEGREES * (Math.PI / 180)
  const snappedAngle = Math.round(Math.atan2(dy, dx) / snapRad) * snapRad
  let sPx = fromPx + dist * Math.cos(snappedAngle)
  let sPy = fromPy + dist * Math.sin(snappedAngle)
  let hasVertexSnap = false

  // ── Step 2: Cardinal vertex alignment (only when snapped to 0/90/180/270°) ──
  const isHorizontal = Math.abs(Math.sin(snappedAngle)) < 0.01
  const isVertical   = Math.abs(Math.cos(snappedAngle)) < 0.01

  if (isHorizontal || isVertical) {
    const thresh = VERTEX_SNAP_PX / vpScale          // alignment tolerance in image px
    const zone   = VERTEX_SNAP_PX * 2 / vpScale      // proximity snap zone in image px
    const lastIdx = polyPoints.length - 2             // skip the point we started from

    let bestZoneDist = zone

    for (let i = 0; i < polyPoints.length; i += 2) {
      if (i === lastIdx) continue
      const vPx = polyPoints[i]     * imageW
      const vPy = polyPoints[i + 1] * imageH

      if (isHorizontal && Math.abs(vPy - fromPy) < thresh) {
        // Vertex shares the same horizontal line as fromP
        if (Math.sign(vPx - fromPx) === Math.sign(Math.cos(snappedAngle))) {
          const d = Math.abs(sPx - vPx)
          if (d < bestZoneDist) {
            bestZoneDist = d
            sPx = vPx; sPy = fromPy
            hasVertexSnap = true
          }
        }
      }

      if (isVertical && Math.abs(vPx - fromPx) < thresh) {
        // Vertex shares the same vertical line as fromP
        if (Math.sign(vPy - fromPy) === Math.sign(Math.sin(snappedAngle))) {
          const d = Math.abs(sPy - vPy)
          if (d < bestZoneDist) {
            bestZoneDist = d
            sPy = vPy; sPx = fromPx
            hasVertexSnap = true
          }
        }
      }
    }
  }

  return { x: sPx / imageW, y: sPy / imageH, hasVertexSnap }
}

interface Viewport { x: number; y: number; scale: number }

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 1200, height: 700 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 10 && height > 10) setSize({ width, height })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export function CalloutCanvas({
  layer,
  callouts,
  selectedId,
  onSelect,
  mode,
  canEdit,
  onCreateCallout,
  onUpdateGeometry,
  highlightId,
}: CalloutCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const viewportGroupRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const selectedNodeRef = useRef<Konva.Node | null>(null)

  const { width: stageW, height: stageH } = useContainerSize(containerRef)
  const [mapImage] = useImage(MAP_IMAGES[layer])

  const imageW = mapImage?.naturalWidth ?? 1920
  const imageH = mapImage?.naturalHeight ?? 1080

  const fitTransform = useMemo<Viewport>(() => {
    const scale = Math.min(stageW / imageW, stageH / imageH)
    return {
      x: (stageW - imageW * scale) / 2,
      y: (stageH - imageH * scale) / 2,
      scale,
    }
  }, [imageW, imageH, stageW, stageH])

  const vpRef = useRef<Viewport>(fitTransform)
  // Track scale as React state so handle circles re-render at the right size
  const [vpScale, setVpScale] = useState(fitTransform.scale)

  const applyViewport = useCallback((vp: Viewport) => {
    vpRef.current = vp
    const grp = viewportGroupRef.current
    if (!grp) return
    grp.x(vp.x)
    grp.y(vp.y)
    grp.scaleX(vp.scale)
    grp.scaleY(vp.scale)
    grp.getLayer()?.batchDraw()
    setVpScale(vp.scale)
  }, [])

  useEffect(() => {
    applyViewport(fitTransform)
  }, [fitTransform, applyViewport])

  const stageToNorm = useCallback(
    (stageX: number, stageY: number) => {
      const vp = vpRef.current
      return {
        x: (stageX - vp.x) / vp.scale / imageW,
        y: (stageY - vp.y) / vp.scale / imageH,
      }
    },
    [imageW, imageH]
  )

  const normToImage = useCallback(
    (nx: number, ny: number) => ({ x: nx * imageW, y: ny * imageH }),
    [imageW, imageH]
  )

  // ── Zoom/Pan state ──────────────────────────────────────────────────────────
  const isPanningRef = useRef(false)
  const panOriginRef = useRef({ mx: 0, my: 0, vpX: 0, vpY: 0 })
  const mouseDownPosRef = useRef({ x: 0, y: 0 })
  const didDragRef = useRef(false)

  const clampScale = useCallback(
    (s: number) =>
      Math.max(fitTransform.scale * MIN_ZOOM_FACTOR, Math.min(fitTransform.scale * MAX_ZOOM_FACTOR, s)),
    [fitTransform.scale]
  )

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()!
      const vp = vpRef.current
      const oldScale = vp.scale
      const newScale = clampScale(e.evt.deltaY < 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED)
      const mousePointTo = {
        x: (pointer.x - vp.x) / oldScale,
        y: (pointer.y - vp.y) / oldScale,
      }
      applyViewport({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    },
    [clampScale, applyViewport]
  )

  // ── Drawing state ───────────────────────────────────────────────────────────
  const isDrawingRef = useRef(false)
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const drawStartNorm = useRef({ x: 0, y: 0 })
  const [polyPoints, setPolyPoints] = useState<number[]>([])
  const [isPolygonOpen, setIsPolygonOpen] = useState(false)
  /** Normalised cursor position while drawing a polygon — drives the live edge preview */
  const [polyMousePos, setPolyMousePos] = useState<{ x: number; y: number } | null>(null)

  // ── Shift-angle-snap ─────────────────────────────────────────────────────────
  const shiftHeldRef = useRef(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') { shiftHeldRef.current = true;  setShiftHeld(true) } }
    const up   = (e: KeyboardEvent) => { if (e.key === 'Shift') { shiftHeldRef.current = false; setShiftHeld(false) } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // ── Transformer sync ────────────────────────────────────────────────────────
  // Only rectangles use the transformer; polygons use vertex handles.
  // Non-editors never get transformer handles.
  useEffect(() => {
    if (!transformerRef.current) return
    const selCallout = callouts.find((c) => c._id === selectedId)
    if (selectedNodeRef.current && mode === 'select' && canEdit && selCallout?.geometry.type === 'rectangle') {
      transformerRef.current.nodes([selectedNodeRef.current])
    } else {
      transformerRef.current.nodes([])
    }
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedId, mode, canEdit, callouts])

  // ── Zoom to selected callout ────────────────────────────────────────────────
  const prevSelectedId = useRef<string | null>(null)
  useEffect(() => {
    const id = selectedId
    if (!id || id === prevSelectedId.current) return
    prevSelectedId.current = id

    const callout = callouts.find((c) => c._id === id)
    if (!callout) return

    let cx = 0, cy = 0
    if (callout.geometry.type === 'rectangle') {
      cx = ((callout.geometry.x ?? 0) + (callout.geometry.width ?? 0) / 2) * imageW
      cy = ((callout.geometry.y ?? 0) + (callout.geometry.height ?? 0) / 2) * imageH
    } else if (callout.geometry.points) {
      const pts = callout.geometry.points
      const xs = pts.filter((_, i) => i % 2 === 0)
      const ys = pts.filter((_, i) => i % 2 !== 0)
      cx = (xs.reduce((a, b) => a + b, 0) / xs.length) * imageW
      cy = (ys.reduce((a, b) => a + b, 0) / ys.length) * imageH
    }

    const targetScale = clampScale(fitTransform.scale * ZOOM_TO_CALLOUT_SCALE)
    const newVp = {
      scale: targetScale,
      x: stageW / 2 - cx * targetScale,
      y: stageH / 2 - cy * targetScale,
    }

    viewportGroupRef.current?.to({
      x: newVp.x,
      y: newVp.y,
      scaleX: newVp.scale,
      scaleY: newVp.scale,
      duration: 0.35,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        vpRef.current = newVp
        setVpScale(newVp.scale)
      },
    })
    vpRef.current = newVp
    setVpScale(newVp.scale)
  }, [selectedId, callouts, imageW, imageH, fitTransform.scale, stageW, stageH, clampScale])

  // Also zoom when highlightId changes (search jump)
  const prevHighlightId = useRef<string | null>(null)
  useEffect(() => {
    const id = highlightId
    if (!id || id === prevHighlightId.current) return
    prevHighlightId.current = id

    const callout = callouts.find((c) => c._id === id)
    if (!callout) return

    let cx = 0, cy = 0
    if (callout.geometry.type === 'rectangle') {
      cx = ((callout.geometry.x ?? 0) + (callout.geometry.width ?? 0) / 2) * imageW
      cy = ((callout.geometry.y ?? 0) + (callout.geometry.height ?? 0) / 2) * imageH
    } else if (callout.geometry.points) {
      const pts = callout.geometry.points
      const xs = pts.filter((_, i) => i % 2 === 0)
      const ys = pts.filter((_, i) => i % 2 !== 0)
      cx = (xs.reduce((a, b) => a + b, 0) / xs.length) * imageW
      cy = (ys.reduce((a, b) => a + b, 0) / ys.length) * imageH
    }

    const targetScale = clampScale(fitTransform.scale * ZOOM_TO_CALLOUT_SCALE)
    const newVp = {
      scale: targetScale,
      x: stageW / 2 - cx * targetScale,
      y: stageH / 2 - cy * targetScale,
    }
    viewportGroupRef.current?.to({
      x: newVp.x,
      y: newVp.y,
      scaleX: newVp.scale,
      scaleY: newVp.scale,
      duration: 0.35,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        vpRef.current = newVp
        setVpScale(newVp.scale)
      },
    })
    vpRef.current = newVp
    setVpScale(newVp.scale)
  }, [highlightId, callouts, imageW, imageH, fitTransform.scale, stageW, stageH, clampScale])

  // ── Input handlers ──────────────────────────────────────────────────────────
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()!
      const pos = stage.getPointerPosition()!
      mouseDownPosRef.current = pos
      didDragRef.current = false

      if (e.evt.button === 1) {
        e.evt.preventDefault()
        isPanningRef.current = true
        panOriginRef.current = { mx: pos.x, my: pos.y, vpX: vpRef.current.x, vpY: vpRef.current.y }
        return
      }

      if (e.evt.button !== 0) return

      const normPos = stageToNorm(pos.x, pos.y)
      const clickedEmpty =
        e.target === stage || e.target.name() === 'map-bg' || e.target.name() === 'map-letterbox'

      if (mode === 'select') {
        if (clickedEmpty) {
          isPanningRef.current = true
          panOriginRef.current = { mx: pos.x, my: pos.y, vpX: vpRef.current.x, vpY: vpRef.current.y }
        }
        return
      }

      if (!canEdit) return

      if (mode === 'rectangle') {
        drawStartNorm.current = normPos
        isDrawingRef.current = true
        setDrawPreview({ x: normPos.x, y: normPos.y, w: 0, h: 0 })
      }

      if (mode === 'polygon') {
        if (!isPolygonOpen) {
          setPolyPoints([normPos.x, normPos.y])
          setIsPolygonOpen(true)
        } else {
          // Close by clicking near the first point (proximity check in screen space, unsnapped)
          if (polyPoints.length >= 6) {
            const vp = vpRef.current
            const firstScreenX = polyPoints[0] * imageW * vp.scale + vp.x
            const firstScreenY = polyPoints[1] * imageH * vp.scale + vp.y
            const dx = pos.x - firstScreenX
            const dy = pos.y - firstScreenY
            if (Math.sqrt(dx * dx + dy * dy) < CLOSE_THRESHOLD) {
              onCreateCallout({ type: 'polygon', points: polyPoints, rotation: 0 })
              setPolyPoints([])
              setIsPolygonOpen(false)
              setPolyMousePos(null)
              return
            }
          }
          // Apply angle + vertex-alignment snap when Shift is held
          const lastNx = polyPoints[polyPoints.length - 2]
          const lastNy = polyPoints[polyPoints.length - 1]
          const snapped = shiftHeldRef.current
            ? snapPolygonPoint(lastNx, lastNy, normPos.x, normPos.y, polyPoints, imageW, imageH, vpRef.current.scale)
            : normPos
          setPolyPoints((prev) => [...prev, snapped.x, snapped.y])
        }
      }
    },
    [mode, canEdit, stageToNorm, isPolygonOpen, polyPoints, imageW, imageH, onCreateCallout]
  )

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()!
      const pos = stage.getPointerPosition()!

      const dx = pos.x - mouseDownPosRef.current.x
      const dy = pos.y - mouseDownPosRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 4) didDragRef.current = true

      if (isPanningRef.current) {
        const { mx, my, vpX, vpY } = panOriginRef.current
        applyViewport({ ...vpRef.current, x: vpX + (pos.x - mx), y: vpY + (pos.y - my) })
        return
      }

      if (isDrawingRef.current && mode === 'rectangle') {
        const normPos = stageToNorm(pos.x, pos.y)
        const start = drawStartNorm.current
        setDrawPreview({
          x: Math.min(start.x, normPos.x),
          y: Math.min(start.y, normPos.y),
          w: Math.abs(normPos.x - start.x),
          h: Math.abs(normPos.y - start.y),
        })
      }

      if (mode === 'polygon' && isPolygonOpen) {
        setPolyMousePos(stageToNorm(pos.x, pos.y))
      }
    },
    [mode, isPolygonOpen, applyViewport, stageToNorm]
  )

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const wasPanning = isPanningRef.current
      isPanningRef.current = false

      if (e.evt.button === 1) return

      if (e.evt.button === 0) {
        if (mode === 'select' && wasPanning && !didDragRef.current) {
          const clickedEmpty =
            e.target === e.target.getStage() ||
            e.target.name() === 'map-bg' ||
            e.target.name() === 'map-letterbox'
          if (clickedEmpty) onSelect(null)
        }

        if (isDrawingRef.current && mode === 'rectangle') {
          isDrawingRef.current = false
          const preview = drawPreview
          setDrawPreview(null)
          if (!preview || preview.w < MIN_DRAW_SIZE || preview.h < MIN_DRAW_SIZE) return
          onCreateCallout({ type: 'rectangle', x: preview.x, y: preview.y, width: preview.w, height: preview.h, rotation: 0 })
        }
      }
    },
    [mode, onSelect, drawPreview, onCreateCallout]
  )

  // Double-click to close polygon (also a fallback for the first-point click)
  const handleStageDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (mode !== 'polygon' || !isPolygonOpen) return
      e.evt.preventDefault()
      // Remove the last point added by the second click of the dblclick
      const finalPoints = polyPoints.slice(0, -2)
      if (finalPoints.length < 6) return
      onCreateCallout({ type: 'polygon', points: finalPoints, rotation: 0 })
      setPolyPoints([])
      setIsPolygonOpen(false)
      setPolyMousePos(null)
    },
    [mode, isPolygonOpen, polyPoints, onCreateCallout]
  )

  const handleBgDblClick = useCallback(() => {
    if (mode !== 'select') return
    viewportGroupRef.current?.to({
      x: fitTransform.x,
      y: fitTransform.y,
      scaleX: fitTransform.scale,
      scaleY: fitTransform.scale,
      duration: 0.35,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => { vpRef.current = fitTransform },
    })
    vpRef.current = fitTransform
  }, [mode, fitTransform])

  // ── Shape drag/transform ─────────────────────────────────────────────────────
  const handleShapeDragEnd = useCallback(
    (callout: CalloutShape, e: Konva.KonvaEventObject<DragEvent>) => {
      if (!canEdit || callout.geometry.type !== 'rectangle') return
      const node = e.target
      const { x: nx, y: ny } = node.position()
      onUpdateGeometry(callout._id, { ...callout.geometry, x: nx / imageW, y: ny / imageH })
    },
    [canEdit, imageW, imageH, onUpdateGeometry]
  )

  const handleTransformEnd = useCallback(
    (callout: CalloutShape, e: Konva.KonvaEventObject<Event>) => {
      if (!canEdit || callout.geometry.type !== 'rectangle') return
      const node = e.target as Konva.Rect
      onUpdateGeometry(callout._id, {
        type: 'rectangle',
        x: node.x() / imageW,
        y: node.y() / imageH,
        width: (node.width() * node.scaleX()) / imageW,
        height: (node.height() * node.scaleY()) / imageH,
        rotation: node.rotation(),
      })
      node.scaleX(1)
      node.scaleY(1)
    },
    [canEdit, imageW, imageH, onUpdateGeometry]
  )

  // ── Polygon vertex drag ──────────────────────────────────────────────────────
  const handleVertexDragEnd = useCallback(
    (callout: CalloutShape, vi: number, e: Konva.KonvaEventObject<DragEvent>) => {
      // Prevent the dragend event bubbling up to the polygon Group's onDragEnd,
      // which would misinterpret the circle's position as a whole-shape drag offset.
      e.cancelBubble = true
      if (!canEdit) return
      const node = e.target as Konva.Circle
      const newNx = node.x() / imageW
      const newNy = node.y() / imageH
      // Reset so Konva node matches the about-to-be-saved position
      node.position({
        x: callout.geometry.points![vi] * imageW,
        y: callout.geometry.points![vi + 1] * imageH,
      })
      const newPoints = [...callout.geometry.points!]
      newPoints[vi] = newNx
      newPoints[vi + 1] = newNy
      onUpdateGeometry(callout._id, { ...callout.geometry, points: newPoints })
    },
    [canEdit, imageW, imageH, onUpdateGeometry]
  )

  // ── Render helpers ───────────────────────────────────────────────────────────
  const previewImageRect = drawPreview
    ? { x: drawPreview.x * imageW, y: drawPreview.y * imageH, w: drawPreview.w * imageW, h: drawPreview.h * imageH }
    : null

  const previewPolyFlat =
    isPolygonOpen && polyPoints.length >= 2
      ? polyPoints.flatMap((p, i) => (i % 2 === 0 ? p * imageW : p * imageH))
      : null

  // Scale handle radius inversely with viewport so they stay constant screen size
  const handleR = HANDLE_RADIUS / vpScale
  const handleStroke = 1.5 / vpScale

  const canClosePoly = isPolygonOpen && polyPoints.length >= 6

  // Live snap result for preview — recomputed on every mouse-move / shift-toggle
  const liveSnap = useMemo(() => {
    if (!isPolygonOpen || !polyMousePos || polyPoints.length < 2) return null
    const lastNx = polyPoints[polyPoints.length - 2]
    const lastNy = polyPoints[polyPoints.length - 1]
    if (!shiftHeld) {
      return { end: polyMousePos, hasVertexSnap: false }
    }
    const result = snapPolygonPoint(lastNx, lastNy, polyMousePos.x, polyMousePos.y, polyPoints, imageW, imageH, vpScale)
    return { end: result, hasVertexSnap: result.hasVertexSnap }
  }, [isPolygonOpen, polyMousePos, polyPoints, shiftHeld, imageW, imageH, vpScale])

  const liveEdgeFlat = useMemo(() => {
    if (!liveSnap || polyPoints.length < 2) return null
    const lastNx = polyPoints[polyPoints.length - 2]
    const lastNy = polyPoints[polyPoints.length - 1]
    const { end } = liveSnap
    return [lastNx * imageW, lastNy * imageH, end.x * imageW, end.y * imageH]
  }, [liveSnap, polyPoints, imageW, imageH])

  const snapIndicatorPos = useMemo(() => {
    if (!liveSnap || !shiftHeld) return null
    return { x: liveSnap.end.x * imageW, y: liveSnap.end.y * imageH, isVertex: liveSnap.hasVertexSnap }
  }, [liveSnap, shiftHeld, imageW, imageH])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-black"
      style={{ cursor: mode === 'select' ? 'grab' : 'crosshair' }}
    >
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleStageDblClick}
      >
        <Layer>
          <Rect
            x={0} y={0} width={stageW} height={stageH}
            fill="#000" name="map-letterbox" onDblClick={handleBgDblClick}
          />

          <Group
            ref={viewportGroupRef}
            x={fitTransform.x} y={fitTransform.y}
            scaleX={fitTransform.scale} scaleY={fitTransform.scale}
          >
            {mapImage && (
              <KonvaImage
                image={mapImage} width={imageW} height={imageH}
                name="map-bg" onDblClick={handleBgDblClick}
              />
            )}

            {/* Callout shapes */}
            {callouts.filter((c) => c.visible).map((callout) => {
              const isSelected = callout._id === selectedId
              const isHighlighted = callout._id === highlightId
              const stroke = isSelected ? '#fff' : isHighlighted ? '#ffe066' : callout.color
              const strokeWidth = (isSelected || isHighlighted) ? 3 : 2
              const fillOpacity = isSelected ? '55' : '33'

              if (callout.geometry.type === 'rectangle') {
                const { x = 0, y = 0, width: w = 0, height: h = 0, rotation = 0 } = callout.geometry
                const { x: px, y: py } = normToImage(x, y)
                const pw = w * imageW, ph = h * imageH
                const lcx = px + pw / 2, lcy = py + ph / 2
                const fs = 14 / vpScale, padV = 3 / vpScale, padH = 6 / vpScale
                const bgW = callout.name.length * fs * 0.52 + padH * 2
                const bgH = fs + padV * 2
                return (
                  <React.Fragment key={callout._id}>
                    <Rect
                      ref={(node) => { if (isSelected && node) selectedNodeRef.current = node }}
                      x={px} y={py} width={pw} height={ph} rotation={rotation}
                      fill={callout.color + fillOpacity} stroke={stroke} strokeWidth={strokeWidth}
                      draggable={canEdit && mode === 'select'}
                      onClick={() => onSelect(callout._id)}
                      onTap={() => onSelect(callout._id)}
                      onDragEnd={(e) => handleShapeDragEnd(callout, e)}
                      onTransformEnd={(e) => handleTransformEnd(callout, e)}
                    />
                    <Rect
                      x={lcx - bgW / 2} y={lcy - bgH / 2}
                      width={bgW} height={bgH}
                      fill="rgba(0,0,0,0.65)" cornerRadius={2 / vpScale} listening={false}
                    />
                    <Text
                      x={lcx - bgW / 2} y={lcy - bgH / 2 + padV}
                      width={bgW} align="center"
                      text={callout.name} fontSize={fs} fontFamily="Barlow" fill="#fff" listening={false}
                    />
                  </React.Fragment>
                )
              }

              if (callout.geometry.type === 'polygon' && callout.geometry.points) {
                const pts = callout.geometry.points
                const flat = pts.flatMap((p, i) => i % 2 === 0 ? p * imageW : p * imageH)
                const xs = flat.filter((_, i) => i % 2 === 0)
                const ys = flat.filter((_, i) => i % 2 !== 0)
                const cx = xs.reduce((a, b) => a + b, 0) / xs.length
                const cy = ys.reduce((a, b) => a + b, 0) / ys.length

                return (
                  // Group wraps Line + vertex handles so they translate together when dragged
                  <Group
                    key={callout._id}
                    draggable={canEdit && mode === 'select'}
                    onDragEnd={(e) => {
                      const grp = e.target as Konva.Group
                      const { x: gx, y: gy } = grp.position()
                      grp.position({ x: 0, y: 0 })
                      if (gx === 0 && gy === 0) return
                      const newPoints = pts.map((p, i) =>
                        i % 2 === 0 ? (p * imageW + gx) / imageW : (p * imageH + gy) / imageH
                      )
                      onUpdateGeometry(callout._id, { ...callout.geometry, points: newPoints })
                    }}
                  >
                    <Line
                      points={flat} closed
                      fill={callout.color + fillOpacity} stroke={stroke} strokeWidth={strokeWidth}
                      onClick={() => onSelect(callout._id)}
                      onTap={() => onSelect(callout._id)}
                    />
                    {(() => {
                      const fs = 14 / vpScale, padV = 3 / vpScale, padH = 6 / vpScale
                      const bgW = callout.name.length * fs * 0.4 + padH * 2
                      const bgH = fs + padV * 2
                      return (
                        <>
                          <Rect
                            x={cx - bgW / 2} y={cy - bgH / 2}
                            width={bgW} height={bgH}
                            fill="rgba(0,0,0,0.65)" cornerRadius={2 / vpScale} listening={false}
                          />
                          <Text
                            x={cx - bgW / 2} y={cy - bgH / 2 + padV}
                            width={bgW} align="center"
                            text={callout.name} fontSize={fs} fontFamily="Barlow" fill="#fff" listening={false}
                          />
                        </>
                      )
                    })()}

                    {/* Vertex edit handles — only for editors with the polygon selected */}
                    {canEdit && mode === 'select' && isSelected &&
                      pts.map((_, vi) => {
                        if (vi % 2 !== 0) return null
                        return (
                          <Circle
                            key={`vtx-${vi}`}
                            x={pts[vi] * imageW}
                            y={pts[vi + 1] * imageH}
                            radius={handleR}
                            fill="#FFD700"
                            stroke="#000"
                            strokeWidth={handleStroke}
                            draggable
                            onDragStart={(e) => { e.cancelBubble = true }}
                            onDragEnd={(e) => handleVertexDragEnd(callout, vi, e)}
                            onClick={(e) => { e.cancelBubble = true }}
                          />
                        )
                      })
                    }
                  </Group>
                )
              }

              return null
            })}

            {/* Drawing previews */}
            {previewImageRect && (
              <Rect
                x={previewImageRect.x} y={previewImageRect.y}
                width={previewImageRect.w} height={previewImageRect.h}
                fill="rgba(255,215,0,0.12)" stroke="#FFD700" strokeWidth={2}
                dash={[8, 4]} listening={false}
              />
            )}
            {previewPolyFlat && previewPolyFlat.length >= 4 && (
              <Line points={previewPolyFlat} stroke="#FFD700" strokeWidth={2} dash={[8, 4]} listening={false} />
            )}

            {/* Live edge from last placed point to cursor (yellow = free, green = snapped) */}
            {liveEdgeFlat && (
              <Line
                points={liveEdgeFlat}
                stroke={shiftHeld ? '#88FF88' : '#FFD700'}
                strokeWidth={1.5}
                dash={[5 / vpScale, 4 / vpScale]}
                listening={false}
              />
            )}
            {/* Snap indicator: ghost circle at snapped landing point */}
            {snapIndicatorPos && (
              <Circle
                x={snapIndicatorPos.x}
                y={snapIndicatorPos.y}
                radius={snapIndicatorPos.isVertex ? handleR * 1.8 : handleR * 1.2}
                fill={snapIndicatorPos.isVertex ? 'rgba(136,255,136,0.35)' : 'rgba(136,255,136,0.2)'}
                stroke={snapIndicatorPos.isVertex ? '#00FF88' : '#88FF88'}
                strokeWidth={snapIndicatorPos.isVertex ? handleStroke * 1.5 : handleStroke}
                listening={false}
              />
            )}

            {/* Polygon drawing anchor circles — scale inversely with zoom */}
            {isPolygonOpen && polyPoints.map((_, i) => {
              if (i % 2 !== 0) return null
              const isFirst = i === 0
              // First point is visually distinct when closeable
              const r = isFirst && canClosePoly ? handleR * 1.6 : handleR
              const fill = isFirst && canClosePoly ? '#ffffff' : '#FFD700'
              return (
                <Circle
                  key={i}
                  x={polyPoints[i] * imageW}
                  y={polyPoints[i + 1] * imageH}
                  radius={r}
                  fill={fill}
                  stroke="#000"
                  strokeWidth={handleStroke}
                  listening={false}
                />
              )
            })}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              boundBoxFunc={(oldBox, newBox) => newBox.width < 5 || newBox.height < 5 ? oldBox : newBox}
            />
          </Group>
        </Layer>
      </Stage>

      {/* HUD overlays */}
      {mode === 'polygon' && isPolygonOpen && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/75 px-3 py-1.5 text-xs text-yellow-400">
          {canClosePoly
            ? 'Click white point to close · double-click · hold Shift to snap 15°'
            : 'Click to add points · hold Shift to snap 15° · need 3+ to close'}
        </div>
      )}
      {mode === 'rectangle' && !drawPreview && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/75 px-3 py-1.5 text-xs text-yellow-400">
          Click and drag to draw a rectangle
        </div>
      )}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded bg-black/60 px-2 py-1 text-xs text-zinc-500">
        Scroll to zoom · Middle-drag or drag empty space to pan · Double-click to reset view
      </div>
    </div>
  )
}
