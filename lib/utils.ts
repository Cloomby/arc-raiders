import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const ROLES = {
  ADMIN: 'admin',
  CONTRIBUTOR: 'contributor',
  READER: 'reader',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// Discord IDs mapped to roles
export const ROLE_MAP: Record<string, Role> = {
  "262755293224632321": ROLES.ADMIN,
  "169458522457636865": ROLES.CONTRIBUTOR,
  "251724989101768705": ROLES.CONTRIBUTOR,
};

export function getRoleFromDiscordId(discordId: string): Role {
  return ROLE_MAP[discordId] ?? ROLES.READER
}

export const COLOR_PRESETS = [
  { name: 'White', color: '#FFFFFF' },
  { name: 'Yellow', color: '#FFD700' },
  { name: 'Red', color: '#FF4444' },
  { name: 'Green', color: '#00FF88' },
  { name: 'Blue', color: '#4488FF' },
  { name: 'Orange', color: '#FF8C00' },
  { name: 'Purple', color: '#CC66FF' },
  { name: 'Cyan', color: '#00DDFF' },
] as const

export type MapLayer = 'top' | 'bottom'
export type DrawingMode = 'select' | 'rectangle' | 'polygon'
