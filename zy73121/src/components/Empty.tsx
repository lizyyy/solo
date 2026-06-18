import { AlertTriangle } from 'lucide-react'

interface EmptyProps {
  title?: string
  description?: string
}

export default function Empty({ title = '暂无数据', description = '当前筛选条件下没有匹配的记录' }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-ocean-800 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-surface mb-2 font-display">{title}</h3>
      <p className="text-muted text-sm">{description}</p>
    </div>
  )
}
