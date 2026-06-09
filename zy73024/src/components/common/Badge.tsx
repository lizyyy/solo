import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'clay' | 'sage' | 'rust' | 'amber' | 'graphite'
  size?: 'sm' | 'md'
  className?: string
}

export default function Badge({ children, variant = 'clay', size = 'sm', className = '' }: BadgeProps) {
  const variantMap = {
    clay: 'bg-clay-50 text-clay-700 border-clay-200',
    sage: 'bg-sage-50 text-sage-700 border-sage-200',
    rust: 'bg-rust-50 text-rust-700 border-rust-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    graphite: 'bg-graphite-50 text-graphite-700 border-graphite-200',
  }
  const sizeMap = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium border ${variantMap[variant]} ${sizeMap[size]} ${className}`}>
      {children}
    </span>
  )
}
