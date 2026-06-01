import { useCraneStore } from '@/store'
import { GitCompare, ArrowRight } from 'lucide-react'

export default function HistoryCompare() {
  const records = useCraneStore(s => s.records)
  const calculations = useCraneStore(s => s.calculations)
  const runHistories = useCraneStore(s => s.runHistories)

  if (runHistories.length === 0) {
    return (
      <div className="harbor-panel p-6 text-center text-gray-500">
        <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">尚未进行重跑对比。点击「重跑全部」后，历史参数将出现在此处。</p>
      </div>
    )
  }

  const latestHistory = runHistories[runHistories.length - 1]
  const oldResults = latestHistory.results
  const oldMap = new Map(oldResults.map(r => [r.recordId, r]))

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <GitCompare className="w-4 h-4" />
        历史参数对比
        <span className="text-xs text-gray-500 font-mono ml-auto">
          重跑于 {new Date(latestHistory.runAt).toLocaleString('zh-CN')}
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-harbor-border">
              <th className="text-left py-2 px-2">记录</th>
              <th className="text-right py-2 px-2">旧周期</th>
              <th className="text-right py-2 px-2">新周期</th>
              <th className="text-right py-2 px-2">旧阻尼</th>
              <th className="text-right py-2 px-2">新阻尼</th>
              <th className="text-right py-2 px-2">旧残余角</th>
              <th className="text-right py-2 px-2">新残余角</th>
              <th className="text-center py-2 px-2">差异</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => {
              const oldCalc = oldMap.get(record.id)
              const newCalc = calculations.find(c => c.recordId === record.id)
              if (!oldCalc || !newCalc) return null

              const periodDiff = newCalc.period - oldCalc.period
              const dampingDiff = newCalc.dampingRatio - oldCalc.dampingRatio
              const angleDiff = newCalc.residualAngle - oldCalc.residualAngle
              const hasDiff = Math.abs(periodDiff) > 0.001 || Math.abs(dampingDiff) > 0.0001 || Math.abs(angleDiff) > 0.001

              return (
                <tr key={record.id} className={`border-b border-harbor-border/30 ${hasDiff ? 'bg-harbor-amber/5' : ''}`}>
                  <td className="py-2 px-2 font-mono text-gray-300">{record.id.slice(0, 12)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-400">{oldCalc.period.toFixed(3)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-200">{newCalc.period.toFixed(3)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-400">{oldCalc.dampingRatio.toFixed(4)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-200">{newCalc.dampingRatio.toFixed(4)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-400">{oldCalc.residualAngle.toFixed(4)}</td>
                  <td className="py-2 px-2 font-mono text-right text-gray-200">{newCalc.residualAngle.toFixed(4)}</td>
                  <td className="py-2 px-2 text-center">
                    {hasDiff ? (
                      <span className="text-harbor-amber">
                        <ArrowRight className="w-3 h-3 inline" />
                        {angleDiff !== 0 && <span className="ml-1">{angleDiff > 0 ? '+' : ''}{angleDiff.toFixed(4)}°</span>}
                      </span>
                    ) : (
                      <span className="text-harbor-green">一致</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
