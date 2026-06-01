import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EngCardProps {
  children: ReactNode
  className?: string
  title?: string
  icon?: ReactNode
}

export default function EngCard({ children, className, title, icon }: EngCardProps) {
  return (
    <div className={cn('eng-card', className)}>
      {title && (
        <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
          {icon && <span className="text-blueprint-600">{icon}</span>}
          <h3 className="font-bold text-ink-800">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
