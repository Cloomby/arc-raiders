'use client'

import { MousePointer2, Square, Pentagon, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { DrawingMode } from '@/lib/utils'

interface DrawingToolbarProps {
  mode: DrawingMode
  onModeChange: (mode: DrawingMode) => void
  canEdit: boolean
  selectedId: string | null
  onDeleteSelected: () => void
  onToggleVisibility: () => void
  selectedVisible?: boolean
}

const tools: { mode: DrawingMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select / Move (V)' },
  { mode: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle (R)' },
  { mode: 'polygon', icon: <Pentagon className="h-4 w-4" />, label: 'Polygon (P) — double-click to close' },
]

export function DrawingToolbar({
  mode,
  onModeChange,
  canEdit,
  selectedId,
  onDeleteSelected,
  onToggleVisibility,
  selectedVisible,
}: DrawingToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 p-1 backdrop-blur-sm">
      {tools.map((tool) => (
        <Tooltip key={tool.mode}>
          <TooltipTrigger asChild>
            <Button
              variant={mode === tool.mode ? 'active' : 'ghost'}
              size="icon"
              onClick={() => onModeChange(tool.mode)}
              disabled={tool.mode !== 'select' && !canEdit}
              aria-label={tool.label}
            >
              {tool.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" avoidCollisions={false}>{tool.label}</TooltipContent>
        </Tooltip>
      ))}

      {selectedId && canEdit && (
        <>
          <div className="mx-1 h-6 w-px bg-zinc-700" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleVisibility}
                aria-label="Toggle visibility"
              >
                {selectedVisible ? (
                  <Eye className="h-4 w-4 text-zinc-300" />
                ) : (
                  <EyeOff className="h-4 w-4 text-zinc-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" avoidCollisions={false}>Toggle visibility</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeleteSelected}
                className={cn('text-red-400 hover:text-red-300')}
                aria-label="Delete callout"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" avoidCollisions={false}>Delete callout</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  )
}
