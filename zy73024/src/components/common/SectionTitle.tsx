import type { ReactNode } from 'react'

interface SectionTitleProps {
  children: ReactNode
  subtitle?: string
  icon?: string
  className?: string
}

export default function SectionTitle({ children, subtitle, icon, className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-end justify-between ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <span className="text-2xl">{icon}</span>}
        <div>
          <h2 className="font-kai text-2xl text-clay-800 tracking-wide">{children}</h2>
          {subtitle && <p className="text-sm text-clay-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
