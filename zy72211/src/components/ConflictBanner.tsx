import { useStore } from '@/store/useStore'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ConflictBanner() {
  const conflicts = useStore((s) => s.conflicts)
  const pending = conflicts.filter((c) => c.resolution === '待裁决')
  const [expanded, setExpanded] = useState(false)

  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
            <AlertTriangle size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              发现 {pending.length} 条双源证据冲突
            </p>
            <p className="text-xs text-amber-600">
              节假日顺延说明与尾差调整条存在矛盾，需要人工裁决
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-amber-500" /> : <ChevronDown size={18} className="text-amber-500" />}
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {pending.map((c) => (
            <div key={c.id} className="bg-white/80 rounded-lg p-4 border border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-2">冲突字段：{c.conflictField}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700 mb-1">节假日顺延说明</p>
                  <p className="text-xs text-slate-700">{c.holidayEvidence}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1">尾差调整条</p>
                  <p className="text-xs text-slate-700">{c.adjustmentEvidence}</p>
                </div>
              </div>
              <Link
                to="/conflict"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
              >
                前往裁决 →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
