import { useEffect } from 'react'
import { useCoralStore } from '@/store/coralStore'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RunSelector() {
  const { runs, currentRunId, loading, fetchRuns, selectRun } = useCoralStore()

  useEffect(() => {
    if (runs.length === 0) {
      fetchRuns()
    }
  }, [])

  const currentRun = runs.find((r: any) => r.id === currentRunId) || runs[0]

  if (runs.length === 0 && loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-ocean-100/50">
        <Activity className="w-3.5 h-3.5 animate-pulse" />
        <span className="skeleton w-40 h-5 rounded" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-ocean-100/50">
        <Activity className="w-3.5 h-3.5" />
        <span>暂无跑批</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Activity className={cn(
        'w-3.5 h-3.5',
        currentRun?.status === 'running' ? 'text-coral-400 animate-pulse' : 'text-seafoam-400'
      )} />
      <select
        value={currentRunId || ''}
        onChange={(e) => selectRun(e.target.value)}
        disabled={loading}
        className="bg-ocean-400/20 text-white text-xs px-2.5 py-1 rounded border border-ocean-300/20 focus:outline-none focus:border-seafoam-400 hover:bg-ocean-400/30 transition-colors disabled:opacity-60 cursor-pointer"
      >
        {runs.map((run: any, idx: number) => (
          <option key={run.id} value={run.id} className="bg-ocean-600 text-white">
            {idx === 0 ? '[最新] ' : ''}
            {new Date(run.run_time).toLocaleString('zh-CN')}
            {' · '}
            记录{run.total_records}/异常{run.anomaly_count}
            {' · '}
            {run.status === 'completed' ? '已完成' : run.status === 'running' ? '运行中' : '失败'}
          </option>
        ))}
      </select>
    </div>
  )
}
