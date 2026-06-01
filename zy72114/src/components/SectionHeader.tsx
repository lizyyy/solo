import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  action?: ReactNode
}

export default function SectionHeader({ title, icon, action }: SectionHeaderProps) {
  return (
    <div className="eng-section-title">
      {icon && <span className="text-blueprint-600">{icon}</span>}
      <span>{title}</span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
