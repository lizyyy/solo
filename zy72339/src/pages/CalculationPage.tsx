import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'
import HistoryTimeline from '@/components/HistoryTimeline'
import { Calculator, Edit3, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import type { RecordType } from '@/types'

const TYPE_LABELS: Record<RecordType, { title: string; desc: string; color: string; border: string }> = {
  smooth: {
    title: '顺利记录',
    desc: '权重格式统一，计算结果一次通过',
    color: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  mixed: {
    title: '混合格式记录',
    desc: '百分数和小数混着出现，活动负责人确认后才出分',
    color: 'text-amber-700',
    border: 'border-amber-200',
  },
  supplement: {
    title: '旧口径补录记录',
    desc: '按补录的旧口径权重计算，和新口径算出来的不一样',
    color: 'text-sky-700',
    border: 'border-sky-200',
  },
}

export default function CalculationPage() {
  const courses = useStore(s => s.courses)
  const calculations = useStore(s => s.calculations)
  const history = useStore(s => s.history)
  const mixedConfirmed = useStore(s => s.mixedConfirmed)
  const calculate = useStore(s => s.calculate)
  const correctRecord = useStore(s => s.correctRecord)
  const rerun = useStore(s => s.rerun)
  const getCourseWeights = useStore(s => s.getCourseWeights)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [correctValue, setCorrectValue] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const hasCalculated = calculations.length > 0

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleCorrect(recordId: string) {
    const val = parseFloat(correctValue)
    if (isNaN(val)) return
    correctRecord(recordId, val, '吴老师')
    setCorrecting(null)
    setCorrectValue('')
  }

  function handleRerun() {
    rerun()
  }

  const allHistory = [...history].reverse()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第三步：计算明细更新
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            跑完之后看三条记录的计算结果，三种处理方式出来的分不一样。有问题的可以人工修正，修正完重跑一遍。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasCalculated && (
            <button
              onClick={calculate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              开始计算
            </button>
          )}
          {hasCalculated && (
            <>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                操作历史
              </button>
              <button
                onClick={handleRerun}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重跑
              </button>
            </>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">全部操作历史</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <HistoryTimeline entries={allHistory} />
        </div>
      )}

      {!hasCalculated ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16">
          <Calculator className="h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm text-slate-400">点击「开始计算」查看三种记录的计算结果</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['smooth', 'mixed', 'supplement'] as RecordType[]).map(type => {
            const cfg = TYPE_LABELS[type]
            const typeRecords = calculations.filter(r => r.recordType === type)
            if (typeRecords.length === 0) return null

            return (
              <section key={type} className={cn('rounded-xl border p-5', cfg.border)}>
                <div className="mb-4">
                  <h3 className={cn('text-sm font-semibold', cfg.color)}>{cfg.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
                </div>

                <div className="space-y-3">
                  {typeRecords.map(record => {
                    const course = courses.find(c => c.id === record.courseId)
                    const weights = getCourseWeights(record.courseId)
                    const isExp = expanded[record.id]
                    const isCorrecting = correcting === record.id
                    const needsConfirm = type === 'mixed' && !mixedConfirmed[record.courseId]

                    return (
                      <div key={record.id} className="rounded-lg border border-slate-100 bg-white">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50"
                          onClick={() => toggleExpand(record.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-700">
                              {course?.name}
                            </span>
                            <StatusBadge type="recordType" value={type} />
                            <StatusBadge type="status" value={record.status} />
                          </div>
                          <div className="flex items-center gap-3">
                            {record.previousScore !== undefined && (
                              <span className="text-xs text-slate-400 line-through font-mono">
                                {record.previousScore}
                              </span>
                            )}
                            <span className="text-lg font-bold font-mono text-slate-800">
                              {record.score}
                            </span>
                            {isExp ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExp && (
                          <div className="border-t border-slate-100 p-4">
                            <table className="w-full text-xs mb-3">
                              <thead>
                                <tr className="text-slate-400">
                                  <th className="pb-2 text-left font-medium">维度</th>
                                  <th className="pb-2 text-right font-medium">权重</th>
                                  <th className="pb-2 text-right font-medium">原始分</th>
                                  <th className="pb-2 text-right font-medium">加权分</th>
                                  <th className="pb-2 text-right font-medium">来源</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(record.detailScores).map(([dim, detail]) => {
                                  const w = weights.find(wt => wt.dimension === dim)
                                  return (
                                    <tr key={dim} className={cn('border-t border-slate-50', w?.isOldCaliber && 'bg-sky-50/50')}>
                                      <td className="py-1.5 text-slate-600">
                                        {dim}
                                        {w?.isOldCaliber && (
                                          <span className="ml-1 text-sky-600">[旧口径]</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right font-mono text-slate-700">
                                        {detail.weight}
                                        {w?.format === 'percentage' && (
                                          <span className="text-amber-500 ml-1">(%)</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right font-mono text-slate-700">{detail.raw}</td>
                                      <td className="py-1.5 text-right font-mono text-slate-700">{detail.weighted}</td>
                                      <td className="py-1.5 text-right text-slate-500">
                                        {w?.source === 'supplement' ? (
                                          <span className="text-sky-600">补录</span>
                                        ) : (
                                          <span>导入</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-200">
                                  <td className="pt-2 text-slate-600 font-medium">最终得分</td>
                                  <td colSpan={3} className="pt-2 text-right font-bold font-mono text-slate-800 text-sm">
                                    {record.score}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>

                            {needsConfirm && (
                              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 mb-3">
                                ⚠ 这条记录的混合格式权重还没确认，得分暂不作为最终结果。
                                请回到第一步，让活动负责人确认后再重跑。
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">
                                最后修改：{record.lastModifiedBy} · {record.lastModifiedAt}
                              </span>
                              {!isCorrecting ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCorrecting(record.id) }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  人工修正
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={correctValue}
                                    onChange={e => setCorrectValue(e.target.value)}
                                    placeholder="输入修正分数"
                                    className="w-28 rounded-md border border-slate-200 px-2 py-1 text-xs font-mono"
                                  />
                                  <button
                                    onClick={() => handleCorrect(record.id)}
                                    className="rounded-md bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600"
                                  >
                                    确认修正
                                  </button>
                                  <button
                                    onClick={() => { setCorrecting(null); setCorrectValue('') }}
                                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                  >
                                    取消
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">计算明细与历史对账</h3>
            <p className="text-xs text-slate-400 mb-4">
              每条记录的得分变化都能在操作历史里找到对应条目。点开上面的「操作历史」按钮查看完整时间线。
            </p>
            <div className="grid grid-cols-3 gap-3">
              {calculations.map(calc => {
                const course = courses.find(c => c.id === calc.courseId)
                return (
                  <div key={calc.id} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                    <div className="text-xs text-slate-500 mb-1">{course?.name}</div>
                    <div className="text-lg font-bold font-mono text-slate-800">{calc.score}</div>
                    <StatusBadge type="status" value={calc.status} />
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
