import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '@/components/StatusBadge'
import { ArrowRight, BookOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const OLD_CALIBER_INFO: Record<string, { dimension: string; newValue: number; oldValue: number; reason: string }> = {
  'c3-内容质量': {
    dimension: '内容质量',
    newValue: 0.25,
    oldValue: 0.35,
    reason: '2024年Q2之前的旧口径，内容质量权重占比较高，后因评分体系调整降至0.25',
  },
}

export default function WeightsPage() {
  const courses = useStore(s => s.courses)
  const weights = useStore(s => s.weights)
  const steps = useStore(s => s.steps)
  const supplementOldCaliber = useStore(s => s.supplementOldCaliber)
  const navigate = useNavigate()

  const [supplemented, setSupplemented] = useState<Record<string, boolean>>({})

  const supplementCourses = courses.filter(c => c.recordType === 'supplement')
  const otherCourses = courses.filter(c => c.recordType !== 'supplement')

  const weightsStep = steps.find(s => s.key === 'weights')

  function handleSupplement(courseId: string, dimension: string, value: number) {
    supplementOldCaliber(courseId, dimension, value)
    setSupplemented(prev => ({ ...prev, [`${courseId}-${dimension}`]: true }))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          第二步：评分权重表补看
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          吴老师打开评分权重表，看看有没有旧口径数据要补录。旧口径就是之前用过的权重值，和现在不一样的地方需要手动补回来。
        </p>
      </div>

      {supplementCourses.length > 0 && (
        <section className="rounded-xl border border-sky-200 bg-sky-50/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-sky-700">需要补录旧口径的记录</h3>
            <StatusBadge type="recordType" value="supplement" />
          </div>
          <p className="text-xs text-slate-500 mb-4">
            下面的课程在评分权重表里有旧口径数据，和当前口径不一样。吴老师需要把旧口径补录到系统里，
            这样跑出来才能和旧数据对上。
          </p>
          {supplementCourses.map(course => (
            <div key={course.id} className="rounded-lg border border-sky-100 bg-white p-4 mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700">{course.name}</span>
                <StatusBadge type="recordType" value="supplement" />
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-2 text-left font-medium">维度</th>
                    <th className="pb-2 text-right font-medium">当前口径</th>
                    <th className="pb-2 text-right font-medium">旧口径</th>
                    <th className="pb-2 text-right font-medium">差异说明</th>
                    <th className="pb-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {weights.filter(w => w.courseId === course.id).map(w => {
                    const key = `${course.id}-${w.dimension}`
                    const oldInfo = OLD_CALIBER_INFO[key]
                    const isSupplemented = supplemented[key]

                    return (
                      <tr key={w.id} className={cn('border-t border-slate-50', oldInfo && !isSupplemented && 'bg-sky-50/50')}>
                        <td className="py-2 text-slate-600">{w.dimension}</td>
                        <td className="py-2 text-right font-mono text-slate-700">{w.numericValue}</td>
                        <td className="py-2 text-right font-mono">
                          {oldInfo ? (
                            <span className={cn('font-medium', isSupplemented ? 'text-emerald-600' : 'text-sky-600')}>
                              {oldInfo.oldValue}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-slate-500 max-w-[200px]">
                          {oldInfo ? oldInfo.reason : '无差异'}
                        </td>
                        <td className="py-2 text-right">
                          {oldInfo && !isSupplemented && (
                            <button
                              onClick={() => handleSupplement(course.id, oldInfo.dimension, oldInfo.oldValue)}
                              className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-600 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              补录
                            </button>
                          )}
                          {isSupplemented && (
                            <span className="text-xs text-emerald-600 font-medium">已补录</span>
                          )}
                          {!oldInfo && (
                            <span className="text-xs text-slate-300">无需操作</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {otherCourses.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">权重表完整，无需补录</h3>
          <p className="text-xs text-slate-400 mb-3">
            这些课程的权重数据在当前口径下完整，没有旧口径差异。
          </p>
          <div className="space-y-3">
            {otherCourses.map(course => (
              <div key={course.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">{course.name}</span>
                  <StatusBadge type="recordType" value={course.recordType} />
                </div>
                <div className="flex gap-3 text-xs">
                  {weights.filter(w => w.courseId === course.id).map(w => (
                    <span key={w.id} className="text-slate-400">
                      {w.dimension}: <span className="font-mono text-slate-600">{w.rawValue}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {weightsStep?.status !== 'pending' && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/calculation')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 transition-colors"
          >
            下一步：计算明细更新
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
