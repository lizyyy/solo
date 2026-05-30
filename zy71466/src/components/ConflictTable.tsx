import { useState } from 'react'
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import type { ConflictRecord } from '@/types'

const conflictTypeMap: Record<ConflictRecord['conflictType'], string> = {
  batch_mismatch: '批次混淆',
  device_anomaly: '设备异常',
  curve_batch_conflict: '曲线-批次冲突',
}

export default function ConflictTable() {
  const conflicts = useAnalysisStore((s) => s.conflicts)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all')

  const filtered = severityFilter === 'all' ? conflicts : conflicts.filter((c) => c.severity === severityFilter)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (conflicts.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-20 text-slate-400')}>
        <AlertCircle className={cn('h-12 w-12 mb-3 opacity-40')} />
        <p className={cn('text-sm')}>未检测到冲突</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 overflow-hidden')}>
      <div className={cn('flex items-center justify-between px-5 py-3 border-b border-[#1B2A4A]')}>
        <h3 className={cn('text-sm font-medium text-slate-200')}>冲突记录</h3>
        <div className={cn('flex items-center gap-1')}>
          {(['all', 'error', 'warning'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setSeverityFilter(level)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors duration-150',
                severityFilter === level
                  ? 'bg-[#E8913A]/20 text-[#E8913A]'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-[#1B2A4A]/40'
              )}
            >
              {level === 'all' ? '全部' : level === 'error' ? '严重' : '警告'}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('overflow-x-auto')}>
        <table className={cn('w-full text-sm')}>
          <thead>
            <tr className={cn('bg-[#1B2A4A]/40')}>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium w-10')}></th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>严重程度</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>样品编号</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>冲突类型</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>描述</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>曲线判断</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>元数据判断</th>
              <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>建议</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => {
              const isExpanded = expandedIds.has(record.curveId)
              return (
                <tr key={record.curveId} className={cn('border-b border-[#1B2A4A]/50')}>
                  <td colSpan={8} className={cn('p-0')}>
                    <div>
                      <div
                        onClick={() => toggleExpand(record.curveId)}
                        className={cn(
                          'flex items-center cursor-pointer transition-colors duration-150',
                          'hover:bg-[#1B2A4A]/30'
                        )}
                      >
                        <div className={cn('px-4 py-2.5 w-10 flex-shrink-0')}>
                          {isExpanded ? (
                            <ChevronUp className={cn('h-4 w-4 text-slate-500')} />
                          ) : (
                            <ChevronDown className={cn('h-4 w-4 text-slate-500')} />
                          )}
                        </div>
                        <div className={cn('px-4 py-2.5 w-20 flex-shrink-0')}>
                          {record.severity === 'error' ? (
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400')}>
                              <AlertTriangle className={cn('h-3 w-3')} />
                              严重
                            </span>
                          ) : (
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400')}>
                              <AlertCircle className={cn('h-3 w-3')} />
                              警告
                            </span>
                          )}
                        </div>
                        <div className={cn('px-4 py-2.5 w-28 flex-shrink-0 text-slate-200')}>{record.sampleId}</div>
                        <div className={cn('px-4 py-2.5 w-32 flex-shrink-0 text-slate-300')}>{conflictTypeMap[record.conflictType]}</div>
                        <div className={cn('px-4 py-2.5 flex-1 text-slate-400 truncate')}>{record.description}</div>
                        <div className={cn('px-4 py-2.5 w-28 flex-shrink-0 text-slate-400 truncate')}>{record.curveJudgment}</div>
                        <div className={cn('px-4 py-2.5 w-28 flex-shrink-0 text-slate-400 truncate')}>{record.metaJudgment}</div>
                        <div className={cn('px-4 py-2.5 w-36 flex-shrink-0 text-slate-400 truncate')}>{record.suggestion}</div>
                      </div>
                      <div className={cn(
                        'overflow-hidden transition-all duration-200',
                        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      )}>
                        <div className={cn('mx-4 mb-3 mt-1 p-4 rounded-lg bg-[#1B2A4A]/30 border border-[#1B2A4A]')}>
                          <p className={cn('text-xs text-slate-500 mb-2')}>原始数据</p>
                          <pre className={cn('text-xs text-slate-300 whitespace-pre-wrap break-all')}>
                            {JSON.stringify(record, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className={cn('py-10 text-center text-sm text-slate-500')}>
          当前筛选条件下无冲突记录
        </div>
      )}
    </div>
  )
}
