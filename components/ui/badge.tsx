import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-700 text-zinc-200',
        enemy: 'border-transparent bg-red-900/50 text-red-300',
        loot: 'border-transparent bg-yellow-900/50 text-yellow-300',
        entry: 'border-transparent bg-green-900/50 text-green-300',
        info: 'border-transparent bg-blue-900/50 text-blue-300',
        danger: 'border-transparent bg-orange-900/50 text-orange-300',
        custom: 'border-transparent bg-zinc-700 text-zinc-200',
        admin: 'border-transparent bg-purple-900/50 text-purple-300',
        contributor: 'border-transparent bg-blue-900/50 text-blue-300',
        reader: 'border-transparent bg-zinc-700 text-zinc-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
