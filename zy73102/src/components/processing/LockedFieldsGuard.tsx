import { useState } from 'react'
import { Lock, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LockedField {
  fieldName: string
  fieldLabel: string
  originalValue: string
  lockedReason: string
}

interface LockedFieldsGuardProps {
  fields: LockedField[]
  className?: string
}

export default function LockedFieldsGuard({ fields, className }: LockedFieldsGuardProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)

  const toggleField = (fieldName: string) => {
    setExpandedField(expandedField === fieldName ? null : fieldName)
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <div className={cn('rounded-xl border border-blue-200 bg-blue-50/50 p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-700">锁定字段守护者</span>
        <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
          {fields.length} 个强制保护
        </span>
      </div>

      <div className="space-y-2">
        {fields.map((field) => {
          const isExpanded = expandedField === field.fieldName
          return (
            <div
              key={field.fieldName}
              className="overflow-hidden rounded-lg border border-blue-200 bg-white"
            >
              <button
                type="button"
                onClick={() => toggleField(field.fieldName)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-50"
              >
                <Lock className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span className="flex-shrink-0 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {field.fieldLabel}
                </span>
                <span className="truncate text-xs text-slate-500">
                  原始值: <span className="font-medium text-slate-700">{field.originalValue}</span>
                </span>
                {isExpanded ? (
                  <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-blue-100 bg-blue-50/50 px-3 py-2.5">
                  <div className="mb-2">
                    <div className="mb-1 text-xs font-medium text-slate-500">原始值</div>
                    <div className="rounded-md bg-white px-3 py-2 text-sm font-mono text-slate-800 shadow-sm">
                      {field.originalValue}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">锁定理由</div>
                    <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      <span className="mt-0.5">⚠️</span>
                      <span>{field.lockedReason}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
