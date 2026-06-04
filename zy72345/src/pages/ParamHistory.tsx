import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { useStore } from '@/store'

const changeTypeConfig: Record<string, { label: string; color: string }> = {
  value: { label: '值变更', color: 'bg-blue-500/10 text-blue-400' },
  remark: { label: '备注修改', color: 'bg-amber-500/10 text-amber-400' },
  boundary_rule: { label: '边界规则', color: 'bg-purple-500/10 text-purple-400' },
}

export default function ParamHistory() {
  const { paramChanges, loading, fetchParamHistory } = useStore()

  useEffect(() => {
    fetchParamHistory()
  }, [])

  return (
    <div className="space-y-6">
      <Link to="/params" className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 text-sm transition-colors">
        <ArrowLeft size={16} />
        返回参数调试表
      </Link>

      <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>参数变更历史</h2>

      <div className="relative pl-8 space-y-6">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700" />
        {paramChanges.length === 0 ? (
          <p className="text-slate-500">暂无参数变更记录</p>
        ) : (
          paramChanges.map(change => {
            const config = changeTypeConfig[change.changeType] || changeTypeConfig.value
            return (
              <div key={change.id} className="relative">
                <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-800" />
                <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-slate-200">{change.paramId}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>{config.label}</span>
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(change.changedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-slate-400">
                      字段: <span className="text-slate-300">{change.field}</span>
                    </p>
                    <p className="text-slate-400">
                      旧值: <span className="line-through text-rose-400">{change.oldValue}</span>
                      {' → '}
                      新值: <span className="text-emerald-400">{change.newValue}</span>
                    </p>
                    <p className="text-slate-500 text-xs">操作人: {change.changedBy}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
