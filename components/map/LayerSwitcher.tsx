'use client'

import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MapLayer } from '@/lib/utils'

interface LayerSwitcherProps {
  current: MapLayer
  onChange: (layer: MapLayer) => void
  topCount: number
  bottomCount: number
}

export function LayerSwitcher({ current, onChange, topCount, bottomCount }: LayerSwitcherProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 p-1 backdrop-blur-sm">
      <Layers className="mx-1 h-4 w-4 text-zinc-400" />
      <Button
        variant={current === 'top' ? 'active' : 'ghost'}
        size="sm"
        onClick={() => onChange('top')}
      >
        Top ({topCount})
      </Button>
      <Button
        variant={current === 'bottom' ? 'active' : 'ghost'}
        size="sm"
        onClick={() => onChange('bottom')}
      >
        Bottom ({bottomCount})
      </Button>
    </div>
  )
}
