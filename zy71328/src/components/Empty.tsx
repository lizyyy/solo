import { cn } from '@/lib/utils'

interface EmptyProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  className?: string
}

export default function Empty({ icon, title, description, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full text-center p-8', className)}>
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      {title && <p className="text-text-primary font-medium mb-2">{title}</p>}
      {description && <p className="text-text-muted text-sm">{description}</p>}
      {!icon && !title && !description && <span>Empty</span>}
    </div>
  )
}
