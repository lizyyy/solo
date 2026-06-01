import { useCraneStore } from '@/store'
import { AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export default function ExceptionTracker() {
  const records = useCraneStore(s => s.records)
  const validations = useCraneStore(s => s.validations)
  const confirmRecord = useCraneStore(s => s.confirmRecord)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const exceptionRecords = records.filter(r =>
    r.status === 'needs_review' || r.status === 'exception'
  )

  if (exceptionRecords.length === 0) {
    return (
      <div className="harbor-panel p-4">
        <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-2">
          <AlertOctagon className="w-4 h-4" />
          例外追踪
        </h3>
        <p className="text-sm text-gray-500">当前无例外记录，所有数据均在阈值内</p>
      </div>
    )
  }

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <AlertOctagon className="w-4 h-4" />
        例外追踪
        <span className="text-xs text-harbor-red font-mono bg-harbor-red/10 px-2 py-0.5 rounded ml-auto">
          {exceptionRecords.length} 条需关注
        </span>
      </h3>
      <div className="space-y-2">
        {exceptionRecords.map(record => {
          const steps = validations.filter(v => v.recordId === record.id && v.result !== 'pass')
          const isExpanded = expandedId === record.id

          return (
            <div key={record.id} className="border-l-4 border-harbor-red bg-harbor-red/5 rounded-r-lg">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-harbor-red/10 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-harbor-red" />
                  <span className="font-mono text-xs text-gray-300">{record.id.slice(0, 16)}</span>
                  <span className="text-xs text-gray-400">
                    {record.swingAngle}{record.swingAngleUnit} | {record.direction}
                  </span>
                </div>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-gray-500" />
                  : <ChevronDown className="w-4 h-4 text-gray-500" />
                }
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1.5">
                  {steps.map(step => (
                    <div key={step.id} className="text-xs flex items-start gap-2">
                      <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full
                        ${step.result === 'fail' ? 'bg-harbor-red' : 'bg-harbor-yellow'}`}
                      />
                      <span className={step.result === 'fail' ? 'text-harbor-red' : 'text-harbor-yellow'}>
                        {step.message}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => confirmRecord(record.id)}
                      className="harbor-btn text-xs py-1 px-3"
                    >
                      确认通过
                    </button>
                    <span className="text-xs text-gray-500 py-1">
                      确认后例外标记将移除，操作记入审计日志
                    </span>
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
