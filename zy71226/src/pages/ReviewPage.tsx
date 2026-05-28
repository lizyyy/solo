import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { ALERT_CONFIG } from '@/utils/scenarioDetect'
import { Play, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, GaugeCircle, Weight, Target, Clock } from 'lucide-react'

export default function ReviewPage() {
  const sessions = useStore(s => s.sessions)
  const loadSession = useStore(s => s.loadSession)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replayIdx, setReplayIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const selected = sessions.find(s => s.id === selectedId)

  const exportReport = (session: typeof sessions[0]) => {
    const data = {
      ...session,
      exportedAt: new Date().toISOString(),
      summary: {
        alertTypes: [...new Set(session.alerts.map(a => a.type))],
        totalSnapshots: session.curveSnapshots.length,
        finalScore: session.durationScore,
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `报告-${session.batchName}-${session.batchDate}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inversionAlerts = selected?.alerts.filter(a => a.type === 'inversion') || []
  const mismatchAlerts = selected?.alerts.filter(a => a.type === 'duration_mismatch') || []
  const overflowAlerts = selected?.alerts.filter(a => a.type === 'weight_overflow') || []

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">练习复盘</h1>
          <p className="text-slate-500 mt-1">回顾历史练习，分析错因</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {sessions.length === 0 ? (
            <div className="lg:col-span-4 glass-panel rounded-xl p-8 text-center">
              <p className="text-slate-500">暂无历史练习，前往工坊开始新练习</p>
            </div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedId(s.id); setReplayIdx(0) }}
                className={`glass-panel rounded-xl p-4 text-left card-hover ${selectedId === s.id ? 'gold-border' : ''}`}
              >
                <div className="font-semibold text-slate-200">{s.batchName}</div>
                <div className="text-xs text-slate-500 mt-1">{s.batchDate}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-mono text-lg text-gold-400">{s.durationScore}<span className="text-xs text-slate-500">分</span></span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.completedAt ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {s.completedAt ? '已完成' : '进行中'}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {s.alerts.filter(a => a.type === 'inversion').length > 0 && <span className="w-2 h-2 rounded-full bg-red-500" title="曲线倒挂" />}
                  {s.alerts.filter(a => a.type === 'duration_mismatch').length > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" title="久期错配" />}
                  {s.alerts.filter(a => a.type === 'weight_overflow').length > 0 && <span className="w-2 h-2 rounded-full bg-yellow-500" title="权重超标" />}
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="glass-panel rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-red-400" />
                  <h3 className="font-semibold text-red-400">曲线倒挂</h3>
                  <span className="ml-auto text-xs text-slate-500 font-mono">{inversionAlerts.length}次</span>
                </div>
                {inversionAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500">本次练习未出现倒挂</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {inversionAlerts.map(a => (
                      <div key={a.id} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs">
                        <div className="text-slate-300">{a.details}</div>
                        <div className="text-slate-500 mt-1 italic">💡 {a.suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GaugeCircle size={18} className="text-orange-400" />
                  <h3 className="font-semibold text-orange-400">久期错配</h3>
                  <span className="ml-auto text-xs text-slate-500 font-mono">{mismatchAlerts.length}次</span>
                </div>
                {mismatchAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500">本次练习未出现错配</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {mismatchAlerts.map(a => (
                      <div key={a.id} className="p-2 rounded bg-orange-500/10 border border-orange-500/20 text-xs">
                        <div className="text-slate-300">{a.details}</div>
                        <div className="text-slate-500 mt-1 italic">💡 {a.suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Weight size={18} className="text-yellow-400" />
                  <h3 className="font-semibold text-yellow-400">权重超标</h3>
                  <span className="ml-auto text-xs text-slate-500 font-mono">{overflowAlerts.length}次</span>
                </div>
                {overflowAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500">本次练习权重合规</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {overflowAlerts.map(a => (
                      <div key={a.id} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs">
                        <div className="text-slate-300">{a.details}</div>
                        <div className="text-slate-500 mt-1 italic">💡 {a.suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-slate-200 mb-4">📋 最终配置摘要</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                    <Target size={14} />
                    久期结果
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">目标久期</span>
                      <span className="font-mono text-sm text-slate-300">{selected.targetDuration.toFixed(2)}年</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">实际久期</span>
                      <span className={`font-mono text-sm ${Math.abs(selected.actualDuration - selected.targetDuration) > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {selected.actualDuration.toFixed(2)}年
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">最终得分</span>
                      <span className={`font-mono text-lg font-bold ${
                        selected.durationScore >= 80 ? 'text-emerald-400' :
                        selected.durationScore >= 50 ? 'text-gold-400' : 'text-red-400'
                      }`}>
                        {selected.durationScore}分
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                    <Clock size={14} />
                    组合权重
                  </div>
                  <div className="space-y-1">
                    {selected.finalWeights?.map((w, i) => {
                      const bond = useStore.getState().bonds[i]
                      return (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-500">{bond?.name || `债券${i+1}`}</span>
                          <span className="font-mono text-slate-300">{w.weight.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between text-xs pt-1 border-t border-navy-600">
                      <span className="text-slate-400">合计</span>
                      <span className={`font-mono font-medium ${
                        (selected.finalWeights?.reduce((s, w) => s + w.weight, 0) || 0) > 100
                          ? 'text-red-400' : 'text-gold-400'
                      }`}>
                        {(selected.finalWeights?.reduce((s, w) => s + w.weight, 0) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                    <AlertTriangle size={14} />
                    收益率曲线
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {selected.finalCurve?.map(p => (
                      <div key={p.tenor} className="text-center">
                        <div className="text-xs text-slate-600">{p.tenor}</div>
                        <div className="font-mono text-xs text-slate-300">{p.rate.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="text-slate-500">形态：</span>
                    <span className={selected.alerts.some(a => a.type === 'inversion') ? 'text-red-400' : 'text-emerald-400'}>
                      {selected.alerts.some(a => a.type === 'inversion') ? '⚠ 倒挂' : '✓ 正常'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200">场景回放</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReplayIdx(Math.max(0, replayIdx - 1))}
                    className="p-2 rounded hover:bg-navy-600 text-slate-400"
                  ><ChevronLeft size={18} /></button>
                  <button
                    onClick={() => {
                      if (isPlaying) return
                      setIsPlaying(true)
                      const play = (i: number) => {
                        if (i >= selected.curveSnapshots.length) { setIsPlaying(false); return }
                        setReplayIdx(i)
                        setTimeout(() => play(i + 1), 400)
                      }
                      play(replayIdx)
                    }}
                    className="p-2 rounded hover:bg-navy-600 text-gold-400"
                    disabled={isPlaying}
                  ><Play size={18} /></button>
                  <button
                    onClick={() => setReplayIdx(0)}
                    className="p-2 rounded hover:bg-navy-600 text-slate-400"
                  ><RotateCcw size={18} /></button>
                  <button
                    onClick={() => setReplayIdx(Math.min(selected.curveSnapshots.length - 1, replayIdx + 1))}
                    className="p-2 rounded hover:bg-navy-600 text-slate-400"
                  ><ChevronRight size={18} /></button>
                  <span className="text-xs text-slate-500 font-mono">
                    {replayIdx + 1} / {selected.curveSnapshots.length}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {selected.curveSnapshots[replayIdx]?.points.map(p => (
                  <div key={p.tenor} className="text-center p-2 rounded bg-navy-700/50">
                    <div className="text-xs text-slate-500">{p.tenor}</div>
                    <div className="font-mono text-sm text-gold-400">{p.rate.toFixed(2)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <input
                  type="range"
                  min="0"
                  max={selected.curveSnapshots.length - 1}
                  value={replayIdx}
                  onChange={e => setReplayIdx(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => loadSession(selected.id)}
                className="px-4 py-2 rounded-lg bg-navy-600 hover:bg-navy-500 text-slate-200 text-sm"
              >
                继续此练习
              </button>
              <button
                onClick={() => exportReport(selected)}
                className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-900 font-medium text-sm"
              >
                导出报告
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
