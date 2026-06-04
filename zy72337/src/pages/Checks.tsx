import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, AlertOctagon, ChevronDown, ChevronRight, Play } from 'lucide-react'
import { useAppStore } from '@/store'
import type { SelfCheckResult } from '@/store'

const checkMeta: Record<string, { title: string; icon: typeof CheckCircle2 }> = {
  duplicate_import: { title: '重复导入检测', icon: AlertOctagon },
  denominator_zero_empty: { title: '分母为0空字符串', icon: AlertTriangle },
  recalc_after_supplement: { title: '补录后重算', icon: Play },
  export_consistency: { title: '导出一致性', icon: CheckCircle2 },
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '通过' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-400', label: '失败' },
  warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '警告' },
}

export default function Checks() {
  const { selfChecks, fetchSelfChecks, runSelfChecks, loading } = useAppStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetchSelfChecks()
  }, [fetchSelfChecks])

  const handleRun = async () => {
    setRunning(true)
    try {
      await runSelfChecks()
    } finally {
      setRunning(false)
    }
  }

  const toggleExpand = (type: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const getCheck = (type: string): SelfCheckResult | undefined => selfChecks.find((c) => c.type === type)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">自检面板</h2>
        <button
          onClick={handleRun}
          disabled={running || loading}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-black font-medium rounded text-sm transition-colors flex items-center gap-2"
        >
          <Play size={14} />
          {running ? '运行中...' : '运行自检'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(checkMeta).map(([type, meta]) => {
          const check = getCheck(type)
          const status = check?.status
          const config = status ? statusConfig[status] : null
          const Icon = meta.icon
          const isExpanded = expanded.has(type)

          return (
            <div key={type} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleExpand(type)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-700/50 transition-colors"
              >
                <Icon size={20} className={config ? config.text : 'text-slate-500'} />
                <span className="flex-1 font-medium text-sm">{meta.title}</span>
                {config && (
                  <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                )}
                {!config && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-600/50 text-slate-400">未运行</span>
                )}
                {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>

              {isExpanded && check && (
                <div className="border-t border-slate-700 p-4">
                  <p className="text-sm text-slate-300 mb-3">{check.message}</p>
                  {check.details.length > 0 && (
                    <div className="space-y-1">
                      {check.details.map((d) => (
                        <div key={d.id} className="flex gap-2 text-xs">
                          <span className="font-mono text-slate-400">{d.id}</span>
                          <span className="text-slate-300">{d.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {check.details.length === 0 && (
                    <p className="text-xs text-slate-500">无异常详情</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
