import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle, Scale, Upload, Eye } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function WeightsPage() {
  const rawData = useStore(s => s.rawData)
  const weights = useStore(s => s.weights)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const setWeight = useStore(s => s.setWeight)
  const markWeightComplete = useStore(s => s.markWeightComplete)
  const selectAnomaly = useStore(s => s.selectAnomaly)

  if (!rawData) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="bg-indigo-900/60 border border-indigo-800/50 rounded-2xl p-10 text-center max-w-md">
          <Upload className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-4">尚未导入数据</p>
          <Link to="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium transition-colors">
            <Upload className="w-4 h-4" /> 前往导入数据
          </Link>
        </div>
      </div>
    )
  }

  const anomalyByColumn = new Map<string, ReturnType<typeof boundaryRecords.filter>>()
  for (const r of boundaryRecords) {
    const arr = anomalyByColumn.get(r.columnName) ?? []
    arr.push(r)
    anomalyByColumn.set(r.columnName, arr)
  }

  const allComplete = weights.length > 0 && weights.every(w => w.isComplete)
  const maxWeight = Math.max(...weights.map(w => w.weight), 1)

  return (
    <div className="min-h-screen bg-indigo-950 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-white tracking-wide">评分权重表</h1>
          <p className="text-gray-400 text-sm">竞赛教练唐老师补看 · 补全后课堂演示结果自动更新 · 所有列基于同一份归一化字段类型</p>
        </header>

        <div className="bg-indigo-900/60 border border-indigo-800/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-800/50 flex items-center gap-3">
            <Scale className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-medium text-lg">权重编辑（数值列参与降维，文本列仅作说明）</h2>
            <span className="text-gray-500 text-sm ml-auto">共 {weights.length} 项 · {rawData.columnTypes.filter(t => t === 'numeric').length} 数值列</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-indigo-800/30">
                  <th className="text-left px-6 py-3 font-medium">列名 · 类型</th>
                  <th className="text-center px-6 py-3 font-medium">当前权重</th>
                  <th className="text-center px-6 py-3 font-medium">状态</th>
                  <th className="text-left px-6 py-3 font-medium">关联异常（来自同一份边界记录）</th>
                  <th className="text-center px-6 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {weights.map(entry => {
                  const columnType = rawData.columnTypes[entry.columnIndex] ?? 'text'
                  const linked = anomalyByColumn.get(entry.columnName) ?? []
                  return (
                    <tr key={entry.id} className={cn('border-b border-indigo-800/20 transition-colors', !entry.isComplete && 'bg-amber-500/10')}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{entry.columnName}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border',
                            columnType === 'numeric' ? 'bg-mint-600/20 text-mint-500 border-mint-500/30' : 'bg-indigo-800/40 text-indigo-300 border-indigo-700/40')}>
                            {columnType === 'numeric' ? '数值' : '文本'}
                          </span>
                          {columnType !== 'numeric' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 border-gray-500/30">不参与数值计算</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number" min={0.1} max={10} step={0.1} value={entry.weight}
                          onChange={e => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val) && val >= 0.1 && val <= 10) setWeight(entry.columnName, val)
                          }}
                          disabled={columnType !== 'numeric'}
                          className="w-20 bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-3 py-1.5 text-center text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {entry.isComplete ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" /> ✓ 已补全
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">待补全</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {linked.length === 0 ? (
                          <span className="text-gray-500 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {linked.map(r => (
                              <button
                                key={r.id}
                                onClick={() => selectAnomaly(r.id)}
                                className={cn('text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 hover:opacity-90',
                                  r.status === 'pending_review' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                  r.status === 'reviewed' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                                  'bg-green-500/15 text-green-400 border-green-500/30')}>
                                <Eye className="w-3 h-3" />
                                第{r.rowIndex + 1}行 · {r.status === 'pending_review' ? '待复核' : r.status === 'reviewed' ? '已复核' : '已解决'}
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!entry.isComplete && columnType === 'numeric' && (
                          <button onClick={() => markWeightComplete(entry.id)} className="px-4 py-1.5 text-sm rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors">
                            确认补全
                          </button>
                        )}
                        {columnType !== 'numeric' && (
                          <span className="text-xs text-gray-500">无需补全</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-indigo-900/60 border border-indigo-800/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-800/50 flex items-center gap-3">
            <Scale className="w-5 h-5 text-mint-500" />
            <h2 className="text-white font-medium text-lg">影响预览 · 所有权重变化同步降维结果</h2>
          </div>
          <div className="p-6 space-y-3">
            {weights.filter(w => rawData.columnTypes[w.columnIndex] === 'numeric').map(entry => {
              const pct = (entry.weight / maxWeight) * 100
              return (
                <div key={entry.id} className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-28 shrink-0 truncate" title={entry.columnName}>{entry.columnName}</span>
                  <div className="flex-1 bg-indigo-950/60 rounded-full h-6 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300',
                      entry.isComplete ? 'bg-gradient-to-r from-mint-600 to-blue-500' : 'bg-amber-500/70')}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-gray-400 text-sm w-10 text-right">{entry.weight.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
          {allComplete && (
            <div className="px-6 py-4 border-t border-indigo-800/30">
              <p className="text-emerald-400 text-sm text-center font-medium">✓ 所有权重已补全，课堂演示结果已更新</p>
            </div>
          )}
        </div>

        <div className="text-center pb-8">
          <Link to="/report" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium transition-colors text-lg">
            补全权重后前往 → 降维报告 <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
