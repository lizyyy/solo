import type { ReactNode } from 'react'

interface IconFlagProps {
  children: ReactNode
  variant?: 'clay' | 'rust' | 'sage'
  pulse?: boolean
  className?: string
}

const variantBg = {
  clay: 'bg-clay',
  rust: 'bg-rust',
  sage: 'bg-sage',
}

export default function IconFlag({ children, variant = 'clay', pulse = false, className = '' }: IconFlagProps) {
  return (
    <span
      className={`flag-badge ${variantBg[variant]} ${pulse ? 'animate-pulse-badge' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
