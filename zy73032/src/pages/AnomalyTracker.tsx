import { useState } from 'react'
import { AlertTriangle, ExternalLink, CheckCircle, Link } from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'
import { formatDateCN } from '../utils/helpers'
import OnboardingSidebar from '../components/OnboardingSidebar'

export default function AnomalyTracker() {
  const anomalies = useReconcileStore((s) => s.anomalies)
  const bindAlias = useReconcileStore((s) => s.bindAlias)
  const [bindingFor, setBindingFor] = useState<string | null>(null)
  const [canonicalName, setCanonicalName] = useState('')
  const [knownPets] = useState<string[]>(['小黄', '阿黑'])

  const scheduleAnomalies = anomalies.filter((a) => a.kind === 'schedule')
  const medicalAnomalies = anomalies.filter((a) => a.kind === 'medical_record')

  const uniqueNames = new Set<string>()
  for (const a of anomalies) {
    const rec = a.record as unknown as Record<string, unknown>
    if (rec.pet_name) uniqueNames.add(String(rec.pet_name))
  }

  const handleBind = async (aliasName: string) => {
    if (!canonicalName.trim()) {
      alert('请输入规范宠物名')
      return
    }
    try {
      await bindAlias(aliasName, canonicalName.trim())
      setBindingFor(null)
      setCanonicalName('')
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-warm-500">冲突别名</p>
            <p className="text-2xl font-bold text-danger-600 mt-1">
              {uniqueNames.size}
            </p>
            <p className="text-xs text-warm-400 mt-1">
              未绑定或存在歧义的宠物名
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-warm-500">受影响排程</p>
            <p className="text-2xl font-bold text-warm-800 mt-1">
              {scheduleAnomalies.length}
            </p>
            <p className="text-xs text-warm-400 mt-1">已隔离出正常汇总</p>
          </div>
          <div className="card">
            <p className="text-sm text-warm-500">受影响病历</p>
            <p className="text-2xl font-bold text-warm-800 mt-1">
              {medicalAnomalies.length}
            </p>
            <p className="text-xs text-warm-400 mt-1">待复核的手写单</p>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title flex items-center gap-2">
            <AlertTriangle size={18} className="text-danger-500" />
            异常来源与影响范围
          </h3>
          <p className="text-sm text-warm-500 mb-4">
            异常记录不计入正常汇总，绑定规范宠物后自动回到待确认明细
          </p>

          {anomalies.length === 0 ? (
            <div className="text-center py-8 text-warm-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-success-400" />
              <p>太棒了，没有异常别名！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(uniqueNames).map((petName) => {
                const relatedAnomalies = anomalies.filter((a) => {
                  const rec = a.record as unknown as Record<string, unknown>
                  return rec.pet_name === petName
                })
                const scheduleCount = relatedAnomalies.filter(
                  (a) => a.kind === 'schedule',
                ).length
                const medicalCount = relatedAnomalies.filter(
                  (a) => a.kind === 'medical_record',
                ).length

                return (
                  <div
                    key={petName}
                    className="border border-danger-200 rounded-xl bg-danger-50/40 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-danger-800 text-lg font-serif">
                          「{petName}」别名未绑定
                        </h4>
                        <p className="text-sm text-danger-600 mt-1">
                          影响 {scheduleCount} 条排程 + {medicalCount} 份病历
                        </p>
                      </div>
                      {bindingFor === petName ? (
                        <div className="flex gap-2 items-start">
                          <select
                            className="input text-sm py-1"
                            value={canonicalName}
                            onChange={(e) => setCanonicalName(e.target.value)}
                          >
                            <option value="">选择已有...</option>
                            {knownPets.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="input text-sm py-1 w-32"
                            placeholder="或新建规范名"
                            value={canonicalName}
                            onChange={(e) => setCanonicalName(e.target.value)}
                          />
                          <button
                            className="btn-primary text-sm py-1"
                            onClick={() => handleBind(petName)}
                          >
                            绑定
                          </button>
                          <button
                            className="btn-ghost text-sm py-1"
                            onClick={() => setBindingFor(null)}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-primary text-sm"
                          onClick={() => {
                            setCanonicalName('')
                            setBindingFor(petName)
                          }}
                        >
                          <Link size={14} /> 绑定规范宠物
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs font-medium text-warm-600 mb-2 flex items-center gap-1">
                          <ExternalLink size={12} /> 需要补看的来源
                        </p>
                        <div className="space-y-1.5">
                          {relatedAnomalies.map((a, idx) => {
                            const rec = a.record as unknown as Record<string, unknown>
                            return (
                              <div
                                key={idx}
                                className="text-xs bg-warm-50 rounded p-2"
                              >
                                <span
                                  className={`tag ${
                                    a.kind === 'schedule'
                                      ? 'bg-brand-100 text-brand-700'
                                      : 'bg-success-100 text-success-700'
                                  }`}
                                >
                                  {a.kind === 'schedule' ? '排程' : '病历'}
                                </span>
                                <span className="text-warm-600 ml-2">
                                  {a.kind === 'schedule'
                                    ? String(rec.course_name || '')
                                    : String(rec.diagnosis || '')}
                                </span>
                                <span className="text-warm-400 ml-2">
                                  {formatDateCN(
                                    String(
                                      rec.course_date || rec.visit_date || '',
                                    ),
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs font-medium text-warm-600 mb-2">
                          影响范围
                        </p>
                        <ul className="space-y-1 text-xs text-warm-600">
                          <li>• 正常汇总排除 {scheduleCount} 条排程</li>
                          <li>• 课时统计不计入 {scheduleCount} 条</li>
                          <li>• 待确认列表不可直接确认</li>
                          <li>• 需先绑定别名 → 再走确认流程</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card bg-amber-50/50 border-amber-200">
          <h3 className="card-title text-amber-800">💡 处理顺序建议</h3>
          <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
            <li>先看「需要补看的来源」，确认是同一只宠物</li>
            <li>再看「影响范围」，评估绑定后对汇总的变化</li>
            <li>点击「绑定规范宠物」，选已有或新建规范名</li>
            <li>绑定后回到排程明细，该记录自动从异常变为待确认</li>
            <li>人工确认后进入正常汇总，操作日志全程留痕</li>
          </ol>
        </div>
      </div>

      <div className="w-80 flex-shrink-0">
        <OnboardingSidebar />
      </div>
    </div>
  )
}
