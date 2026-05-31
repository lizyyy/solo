import { useState } from 'react'
import { ChevronDown, ChevronRight, Check, Lightbulb } from 'lucide-react'
import type { Judgment } from '@/types'
import { RULE_TYPE_LABELS } from '@/types'
import SeverityTag from '@/components/SeverityTag'
import { cn } from '@/lib/utils'

interface JudgmentCardProps {
  judgment: Judgment
  onConfirm?: (judgmentId: string) => void
  confirming?: boolean
}

export default function JudgmentCard({ judgment, onConfirm, confirming }: JudgmentCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card">
      <button
        type="button"
        className="w-full card-header flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-primary">{judgment.ruleName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {RULE_TYPE_LABELS[judgment.ruleType]}
          </span>
          <SeverityTag level={judgment.severity === 'info' ? 'low' : judgment.severity === 'warning' ? 'medium' : 'critical'} />
        </div>
        <span className={cn('text-xs', judgment.confirmed ? 'text-success' : 'text-amber-600')}>
          {judgment.confirmed ? '已确认' : '待确认'}
        </span>
      </button>

      {expanded && (
        <div className="card-body space-y-4">
          <div>
            <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-1">判断结论</h4>
            <p className="text-sm text-primary">{judgment.conclusion}</p>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              判断理由
            </h4>
            <p className="text-sm text-amber-900 leading-relaxed">{judgment.reasoning}</p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              建议下一步
            </h4>
            <p className="text-sm text-blue-900 leading-relaxed">{judgment.suggestedAction}</p>
          </div>

          <div>
            <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-1">匹配数据</h4>
            <pre className="text-xs bg-gray-50 rounded-md p-3 overflow-x-auto font-mono text-gray-600 leading-relaxed">
              {JSON.stringify(judgment.matchedData, null, 2)}
            </pre>
          </div>

          {!judgment.confirmed && onConfirm && (
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={confirming}
                onClick={() => onConfirm(judgment.id)}
              >
                {confirming ? '确认中…' : '确认判断'}
              </button>
            </div>
          )}

          {judgment.confirmed && judgment.confirmedBy && (
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              已由 {judgment.confirmedBy} 于 {judgment.confirmedAt} 确认
            </div>
          )}
        </div>
      )}
    </div>
  )
}
