import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useAliasStore } from '@/store/useAliasStore'

export default function ConflictAlert() {
  const conflicts = useAliasStore((s) => s.conflicts)

  const handleScrollToField = (fieldId: string) => {
    const element = document.querySelector(`[data-field-id="${fieldId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  if (conflicts.length === 0) {
    return (
      <div className="w-full mb-4 bg-safe-glow border border-safe text-safe px-4 py-3 rounded flex items-center gap-2">
        <CheckCircle className="w-5 h-5 flex-shrink-0" />
        <span>无别名冲突</span>
      </div>
    )
  }

  return (
    <div className="w-full mb-4 bg-warn-glow border border-warn text-warn px-4 py-3 rounded">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">检测到 {conflicts.length} 个别名冲突</div>
        </div>
      </div>
      <ul className="ml-7 space-y-1 text-sm">
        {conflicts.map((conflict, index) => (
          <li key={index} className="flex items-center gap-2">
            <span>
              • 别名 '{conflict.aliasName}' 同时被 {conflict.fieldLabels.join('、')} 使用
            </span>
            <button
              onClick={() => handleScrollToField(conflict.fieldIds[0])}
              className="text-xs underline hover:opacity-80"
            >
              查看详情
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
