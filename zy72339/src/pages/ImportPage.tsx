import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '@/components/StatusBadge'
import { Upload, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export default function ImportPage() {
  const courses = useStore(s => s.courses)
  const weights = useStore(s => s.weights)
  const steps = useStore(s => s.steps)
  const mixedConfirmed = useStore(s => s.mixedConfirmed)
  const importBoundaryValues = useStore(s => s.importBoundaryValues)
  const confirmMixed = useStore(s => s.confirmMixed)
  const navigate = useNavigate()

  const [imported, setImported] = useState(false)
  const importStep = steps.find(s => s.key === 'import')

  const mixedCourses = courses.filter(c => c.recordType === 'mixed')
  const smoothCourses = courses.filter(c => c.recordType === 'smooth')
  const supplementCourses = courses.filter(c => c.recordType === 'supplement')

  function handleImport() {
    importBoundaryValues()
    setImported(true)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第一步：边界值说明导入
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            把边界值说明里的数据导进来。碰到百分数和小数混着出现的，别急着归正常——留给活动负责人复核。
          </p>
        </div>
        {!imported && (
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 transition-colors"
          >
            <Upload className="h-4 w-4" />
            导入边界值说明
          </button>
        )}
        {imported && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            已导入
          </div>
        )}
      </div>

      {!imported ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16">
          <Upload className="h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm text-slate-400">点击上方按钮导入边界值说明数据</p>
          <p className="mt-1 text-xs text-slate-300">
            系统会自动识别百分数与小数混出的字段
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {smoothCourses.length > 0 && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-emerald-700">顺利记录</h3>
                <StatusBadge type="recordType" value="smooth" />
              </div>
              <p className="text-xs text-slate-500 mb-3">
                这几条权重格式统一，全是小数，导入时没有任何异常。
              </p>
              {smoothCourses.map(course => (
                <div key={course.id} className="rounded-lg border border-emerald-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">{course.name}</span>
                    <StatusBadge type="recordType" value="smooth" />
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-2 text-left font-medium">维度</th>
                        <th className="pb-2 text-right font-medium">原始值</th>
                        <th className="pb-2 text-right font-medium">格式</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weights.filter(w => w.courseId === course.id).map(w => (
                        <tr key={w.id} className="border-t border-slate-50">
                          <td className="py-1.5 text-slate-600">{w.dimension}</td>
                          <td className="py-1.5 text-right font-mono text-slate-700">{w.rawValue}</td>
                          <td className="py-1.5 text-right">
                            <span className="text-emerald-600">小数</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {mixedCourses.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-700">混合格式记录</h3>
                <StatusBadge type="recordType" value="mixed" />
              </div>
              <p className="text-xs text-slate-500 mb-3">
                下面这几条权重里百分数和小数混着出现了。系统不会自动归为正常值，先标记为"待复核"，等活动负责人确认。
              </p>
              {mixedCourses.map(course => {
                const isConfirmed = mixedConfirmed[course.id]
                return (
                  <div key={course.id} className={cn(
                    'rounded-lg border p-4',
                    isConfirmed ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-white'
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">{course.name}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge type="recordType" value="mixed" />
                        {isConfirmed && <StatusBadge type="status" value="pass" />}
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="pb-2 text-left font-medium">维度</th>
                          <th className="pb-2 text-right font-medium">原始值</th>
                          <th className="pb-2 text-right font-medium">格式</th>
                          <th className="pb-2 text-right font-medium">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weights.filter(w => w.courseId === course.id).map(w => {
                          const isMixed = w.format === 'percentage'
                          return (
                            <tr key={w.id} className={cn('border-t border-slate-50', isMixed && 'bg-amber-50/50')}>
                              <td className="py-1.5 text-slate-600">{w.dimension}</td>
                              <td className="py-1.5 text-right font-mono text-slate-700">{w.rawValue}</td>
                              <td className="py-1.5 text-right">
                                <span className={isMixed ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                                  {isMixed ? '百分数' : '小数'}
                                </span>
                              </td>
                              <td className="py-1.5 text-right">
                                {isMixed ? (
                                  <span className="text-amber-600">待复核</span>
                                ) : (
                                  <span className="text-slate-400">正常</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {!isConfirmed && (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 p-3">
                        <span className="text-xs text-amber-700">
                          活动负责人，请确认这些混合格式权重是否可以归入正常计算
                        </span>
                        <button
                          onClick={() => confirmMixed(course.id)}
                          className="ml-3 shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
                        >
                          确认归入
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {supplementCourses.length > 0 && (
            <section className="rounded-xl border border-sky-200 bg-sky-50/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm font-semibold text-sky-700">旧口径待补录</h3>
                <StatusBadge type="recordType" value="supplement" />
              </div>
              <p className="text-xs text-slate-500 mb-3">
                这条记录的部分权重在评分权重表里有旧口径数据，下一步要去权重表补录。现在先导入当前口径。
              </p>
              {supplementCourses.map(course => (
                <div key={course.id} className="rounded-lg border border-sky-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">{course.name}</span>
                    <StatusBadge type="recordType" value="supplement" />
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-2 text-left font-medium">维度</th>
                        <th className="pb-2 text-right font-medium">当前值</th>
                        <th className="pb-2 text-right font-medium">格式</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weights.filter(w => w.courseId === course.id).map(w => (
                        <tr key={w.id} className="border-t border-slate-50">
                          <td className="py-1.5 text-slate-600">{w.dimension}</td>
                          <td className="py-1.5 text-right font-mono text-slate-700">{w.rawValue}</td>
                          <td className="py-1.5 text-right">
                            <span className="text-slate-500">小数</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-xs text-sky-600">
                    ⚠ 需要到下一步「评分权重表补看」中补录旧口径数据
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {imported && importStep?.status === 'completed' && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/weights')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 transition-colors"
          >
            下一步：评分权重表补看
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
