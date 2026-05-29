import { useState } from 'react'
import { ValidationIssue } from '@/types'
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, DollarSign } from 'lucide-react'

interface AnomalyBannerProps {
  issues: ValidationIssue[]
  budgetOverrunCount: number
}

export default function AnomalyBanner({ issues, budgetOverrunCount }: AnomalyBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const outOfRange = issues.filter((i) => i.type === 'coefficient_out_of_range').length
  const missing = issues.filter((i) => i.type === 'frequency_missing').length
  const total = outOfRange + missing + budgetOverrunCount

  if (total === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#2a3f35' }}>
      <div className="flex items-center px-4 py-2.5 bg-amber-900/40">
        <div className="flex gap-6 flex-1 text-sm">
          <span className="flex items-center gap-1.5 text-red-400">
            <AlertCircle size={14} />{outOfRange}个系数越界
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <AlertTriangle size={14} />{missing}个低频缺样
          </span>
          <span className="flex items-center gap-1.5 text-orange-400">
            <DollarSign size={14} />{budgetOverrunCount}个预算超限
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {expanded && (
        <div className="px-4 py-2 text-xs space-y-1 max-h-32 overflow-y-auto">
          {issues.map((issue, idx) => (
            <div key={idx} className={issue.severity === 'error' ? 'text-red-300' : 'text-yellow-300'}>
              {issue.detail}
            </div>
          ))}
          {budgetOverrunCount > 0 && (
            <div className="text-orange-300">{budgetOverrunCount}个材料超出预算单价</div>
          )}
        </div>
      )}
    </div>
  )
}
