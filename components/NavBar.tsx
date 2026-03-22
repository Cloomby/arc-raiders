'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { LogIn, LogOut, Shield, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from './map/SearchBar'
import { LayerSwitcher } from './map/LayerSwitcher'
import type { MapLayer } from '@/lib/utils'

interface NavBarProps {
  callouts?: Array<{ _id: string; name: string; layer: string }>
  onJumpTo?: (id: string) => void
  layer?: MapLayer
  onLayerChange?: (layer: MapLayer) => void
  topCount?: number
  bottomCount?: number
}

export function NavBar({
  callouts = [],
  onJumpTo,
  layer,
  onLayerChange,
  topCount = 0,
  bottomCount = 0,
}: NavBarProps) {
  const { data: session, status } = useSession()

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-700/80 bg-zinc-950/90 px-4 backdrop-blur-sm">
      {/* Logo / Title */}
      <Link href="/" className="flex items-center gap-2 text-sm font-bold text-zinc-100">
        <span className="text-yellow-400">ARC</span>
        <span className="hidden text-zinc-400 sm:inline">Raiders</span>
        <span className="hidden text-zinc-600 sm:inline">/ Stella Montis</span>
      </Link>

      <div className="mx-2 h-5 w-px bg-zinc-700" />

      {/* Layer switcher */}
      {layer && onLayerChange && (
        <LayerSwitcher
          current={layer}
          onChange={onLayerChange}
          topCount={topCount}
          bottomCount={bottomCount}
        />
      )}

      <div className="flex-1" />

      {/* Search */}
      {onJumpTo && (
        <SearchBar callouts={callouts} onJumpTo={onJumpTo} />
      )}

      <div className="mx-2 h-5 w-px bg-zinc-700" />

      {/* Auth */}
      {status === 'loading' ? (
        <div className="h-7 w-20 animate-pulse rounded bg-zinc-800" />
      ) : session ? (
        <div className="flex items-center gap-2">
          {session.user.role === 'admin' && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-purple-400 hover:text-purple-300">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? 'User'}
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {session.user.name}
            </span>
            <Badge
              variant={session.user.role as 'admin' | 'contributor' | 'reader'}
              className="hidden sm:flex"
            >
              {session.user.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 text-zinc-400" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => signIn('discord')}
          className="gap-1.5"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Discord
        </Button>
      )}
    </header>
  )
}
