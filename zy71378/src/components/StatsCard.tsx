import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: number | string
  icon: ReactNode
  trend?: string
  color?: 'amber' | 'emerald' | 'red' | 'blue'
}

const colorMap = {
  amber: 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
  emerald: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
  red: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
  blue: 'bg-[var(--color-blue)]/15 text-[var(--color-blue)]',
}

const trendColorMap = {
  amber: 'text-[var(--color-amber)]',
  emerald: 'text-[var(--color-emerald)]',
  red: 'text-[var(--color-red)]',
  blue: 'text-[var(--color-blue)]',
}

export default function StatsCard({ title, value, icon, trend, color = 'amber' }: StatsCardProps) {
  return (
    <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            {title}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-text-primary)]">
            {value}
          </p>
          {trend && (
            <p className={cn('mt-1 text-xs font-mono', trendColorMap[color])}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg', colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}
