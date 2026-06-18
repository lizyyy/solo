import { useEffect, useState } from 'react'
import { useCoralStore } from '@/store/coralStore'
import { GitBranch, ArrowRight } from 'lucide-react'

export default function ParameterTrace() {
  const { snapshots, loading, fetchSnapshots, fetchParameterDiff } = useCoralStore()
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [diff, setDiff] = useState<any>(null)

  useEffect(() => {
    fetchSnapshots()
  }, [])

  const handleDiff = async () => {
    if (fromId && toId) {
      const result = await fetchParameterDiff(fromId, toId)
      setDiff(result)
    }
  }

  useEffect(() => {
    if (fromId && toId) {
      handleDiff()
    }
  }, [fromId, toId])

  return (
    <div className="flex gap-6 animate-fade-in min-h-0">
      <div className="w-80 shrink-0">
        <h3 className="font-serif text-white text-base mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-seafoam-400" />
          参数快照时间线
        </h3>
        <div className="glass-card p-4 space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto">
          {loading && snapshots.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-ocean-400 text-center py-8 text-sm">暂无快照数据</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-ocean-100" />
              {snapshots.map((snapshot: any, idx: number) => {
                const isFrom = fromId === snapshot.id
                const isTo = toId === snapshot.id
                return (
                  <div key={snapshot.id} className="relative flex items-start gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                      isFrom ? 'bg-coral-500 border-coral-500' : isTo ? 'bg-seafoam-500 border-seafoam-500' : 'bg-white border-ocean-200'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isFrom || isTo ? 'bg-white' : 'bg-ocean-200'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ocean-400">
                        {new Date(snapshot.snapshot_time).toLocaleString('zh-CN')}
                      </p>
                      <p className="text-sm text-ocean-500 font-mono">Step #{snapshot.change_step}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            name="from"
                            checked={isFrom}
                            onChange={() => { setFromId(snapshot.id); if (toId === snapshot.id) setToId(null) }}
                            className="text-coral-500 focus:ring-coral-500"
                          />
                          <span className="text-coral-500">基准</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            name="to"
                            checked={isTo}
                            onChange={() => { setToId(snapshot.id); if (fromId === snapshot.id) setFromId(null) }}
                            className="text-seafoam-500 focus:ring-seafoam-500"
                          />
                          <span className="text-seafoam-600">对比</span>
                        </label>
                      </div>
                      {snapshot.impact_summary && (
                        <p className="text-xs text-ocean-400 mt-1 truncate">
                          {typeof snapshot.impact_summary === 'string' ? snapshot.impact_summary : JSON.stringify(snapshot.impact_summary)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-white text-base mb-4 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-seafoam-400" />
          参数 Diff 对比
        </h3>
        {diff ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-ocean-300">
              <span className="bg-coral-100 text-coral-700 px-2 py-1 rounded">基准: {new Date(diff.from.snapshot_time).toLocaleString('zh-CN')}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="bg-seafoam-100 text-seafoam-700 px-2 py-1 rounded">对比: {new Date(diff.to.snapshot_time).toLocaleString('zh-CN')}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-ocean-500 mb-3">基准参数</h4>
                <div className="space-y-1.5 font-mono text-sm">
                  {Object.entries(diff.from.parameters).map(([key, value]) => {
                    const isChanged = diff.diff.changed.some((c: any) => c.field === key)
                    const isRemoved = diff.diff.removed.includes(key)
                    return (
                      <div key={key} className={`flex items-center gap-2 py-1 px-2 rounded ${
                        isChanged ? 'bg-red-50' : isRemoved ? 'bg-red-50' : ''
                      }`}>
                        <span className="text-ocean-400 w-36 truncate">{key}</span>
                        <span className={`${isChanged ? 'text-red-600 line-through' : isRemoved ? 'text-red-400 line-through' : 'text-ocean-500'}`}>
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-ocean-500 mb-3">对比参数</h4>
                <div className="space-y-1.5 font-mono text-sm">
                  {Object.entries(diff.to.parameters).map(([key, value]) => {
                    const isChanged = diff.diff.changed.some((c: any) => c.field === key)
                    const isAdded = diff.diff.added.includes(key)
                    return (
                      <div key={key} className={`flex items-center gap-2 py-1 px-2 rounded ${
                        isChanged ? 'bg-green-50' : isAdded ? 'bg-green-50' : ''
                      }`}>
                        <span className="text-ocean-400 w-36 truncate">{key}</span>
                        <span className={`${isChanged ? 'text-green-600 font-semibold' : isAdded ? 'text-green-600 font-semibold' : 'text-ocean-500'}`}>
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {diff.diff.changed.length > 0 && (
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-ocean-500 mb-3">变更详情</h4>
                <div className="space-y-2">
                  {diff.diff.changed.map((c: any) => (
                    <div key={c.field} className="flex items-center gap-3 text-sm py-2 border-b border-ocean-50 last:border-0">
                      <span className="font-mono text-ocean-500 w-40">{c.field}</span>
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-mono line-through">
                        {JSON.stringify(c.from)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-ocean-300" />
                      <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded text-xs font-mono">
                        {JSON.stringify(c.to)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="text-ocean-400 text-sm">请在左侧选择两个快照进行对比</p>
            <p className="text-ocean-300 text-xs mt-1">选择"基准"和"对比"两个快照后，将自动展示参数差异</p>
          </div>
        )}
      </div>
    </div>
  )
}
