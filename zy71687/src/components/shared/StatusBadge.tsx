import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'gray' | 'cyan'

interface StatusBadgeProps {
  label: string
  variant: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  gray: 'bg-white/5 text-white/50 border-white/10',
  cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}

export default function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {label}
    </span>
  )
}
