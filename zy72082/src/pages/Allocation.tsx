import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/store'
import {
  Play,
  Save,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ThermometerSnowflake,
  Route,
  Truck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import type { AllocationParams, CalcStep } from '@/types'

type ParamForm = Pick<AllocationParams, 'tempZoneMin' | 'tempZoneMax' | 'maxMileage' | 'vehicleCapacity'>

const DEFAULT_PARAMS: ParamForm = {
  tempZoneMin: -25,
  tempZoneMax: -15,
  maxMileage: 200,
  vehicleCapacity: 20,
}

export default function Allocation() {
  const {
    params, records, results, calcSteps, currentParamVersionId,
    loadData, saveParamVersion, runAllocation, toggleAnomaly, setCurrentParamVersion,
  } = useStore()

  const [form, setForm] = useState<ParamForm>(DEFAULT_PARAMS)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => { loadData() }, [loadData])

  const currentParam = params.find((p) => p.id === currentParamVersionId)

  useEffect(() => {
    if (currentParam) {
      setForm({
        tempZoneMin: currentParam.tempZoneMin,
        tempZoneMax: currentParam.tempZoneMax,
        maxMileage: currentParam.maxMileage,
        vehicleCapacity: currentParam.vehicleCapacity,
      })
    }
  }, [currentParam])

  const handleSave = useCallback(async () => {
    await saveParamVersion(form)
  }, [form, saveParamVersion])

  const handleRun = useCallback(async () => {
    if (!currentParamVersionId) return
    setRunning(true)
    try { await runAllocation(currentParamVersionId) } finally { setRunning(false) }
  }, [currentParamVersionId, runAllocation])

  const anomalyRecords = records.filter((r) => r.isAnomaly)

  const stepMap = new Map<number, CalcStep>()
  calcSteps.forEach((s) => { if (s.resultId) stepMap.set(s.resultId, s) })

  const setField = (k: keyof ParamForm, v: number) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="section-title">仓库冷链路线分配</h1>
        <div className="flex items-center gap-3">
          <select
            className="select-field text-xs min-w-[160px]"
            value={currentParamVersionId ?? ''}
            onChange={(e) => setCurrentParamVersion(Number(e.target.value))}
          >
            <option value="" disabled>选择参数版本</option>
            {params.map((p) => (
              <option key={p.id} value={p.id}>{p.versionLabel}</option>
            ))}
          </select>
          <button className="btn-secondary flex items-center gap-1.5" onClick={handleSave}>
            <Save className="w-3.5 h-3.5" />保存为新版本
          </button>
          <button className="btn-primary flex items-center gap-1.5" disabled={!currentParamVersionId || running} onClick={handleRun}>
            <Play className="w-3.5 h-3.5" />{running ? '计算中...' : '执行分配'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'tempZoneMin' as keyof ParamForm, label: '温区参数', icon: ThermometerSnowflake, unit: '°C', dual: true },
          { key: 'maxMileage' as keyof ParamForm, label: '里程参数', icon: Route, unit: 'km', dual: false },
          { key: 'vehicleCapacity' as keyof ParamForm, label: '容量参数', icon: Truck, unit: '吨', dual: false },
        ]).map((group) => (
          <div key={group.key} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <group.icon className="w-4 h-4 text-teal-800" />
              <span className="label-text">{group.label}</span>
            </div>
            {group.dual ? (
              <div className="flex items-center gap-2">
                <input type="number" className="input-field w-full" value={form.tempZoneMin}
                  onChange={(e) => setField('tempZoneMin', Number(e.target.value))} />
                <span className="text-slate-400 text-xs">~</span>
                <input type="number" className="input-field w-full" value={form.tempZoneMax}
                  onChange={(e) => setField('tempZoneMax', Number(e.target.value))} />
                <span className="text-xs text-slate-400">{group.unit}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" className="input-field w-full" value={form[group.key]}
                  onChange={(e) => setField(group.key, Number(e.target.value))} />
                <span className="text-xs text-slate-400">{group.unit}</span>
              </div>
            )}
            {currentParam && (
              <p className="mt-2 text-[10px] text-slate-400">当前版本: {currentParam.versionLabel}</p>
            )}
          </div>
        ))}
      </div>

      {calcSteps.length > 0 && (
        <section>
          <h2 className="section-title mb-3">计算过程</h2>
          <div className="space-y-2">
            {calcSteps.map((step, idx) => (
              <div key={step.id} className="card px-4 py-3">
                <button className="w-full flex items-center gap-2 text-left" onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}>
                  {expandedStep === idx ? <ChevronDown className="w-3.5 h-3.5 text-teal-800" /> : <ChevronRight className="w-3.5 h-3.5 text-teal-800" />}
                  <span className="text-sm font-medium text-navy-950">{step.description}</span>
                  <span className="badge-info ml-auto">{step.paramVersionId}</span>
                  {step.isAnomaly && <span className="badge-warning"><AlertTriangle className="w-3 h-3 mr-1" />{step.anomalyReason}</span>}
                </button>
                {expandedStep === idx && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><span className="label-text">输入</span><pre className="mt-1 bg-slate-50 rounded p-2 data-cell overflow-auto max-h-32">{JSON.stringify(JSON.parse(step.inputValues), null, 2)}</pre></div>
                    <div><span className="label-text">输出</span><pre className="mt-1 bg-slate-50 rounded p-2 data-cell overflow-auto max-h-32">{JSON.stringify(JSON.parse(step.outputValues), null, 2)}</pre></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section>
          <h2 className="section-title mb-3">分配结果</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-teal-50 border-b border-slate-150">
                  {['路线ID', '仓库ID', '车辆ID', '分配温度', '分配里程', '分配载重', '效率', '异常状态'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left label-text">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const step = stepMap.get(r.id!)
                  const isExp = expandedRow === r.id
                  return (
                    <tr key={r.id} className="border-b border-slate-150 hover:bg-teal-50/40 cursor-pointer" onClick={() => setExpandedRow(isExp ? null : r.id!)}>
                      <td className="px-3 py-2 data-cell">{r.routeId}</td>
                      <td className="px-3 py-2 data-cell">{r.warehouseId}</td>
                      <td className="px-3 py-2 data-cell">{r.vehicleId}</td>
                      <td className="px-3 py-2 data-cell">{r.assignedTemp}°C</td>
                      <td className="px-3 py-2 data-cell">{r.assignedMileage}km</td>
                      <td className="px-3 py-2 data-cell">{r.assignedLoad}吨</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${r.efficiency >= 0.7 ? 'badge-success' : r.efficiency >= 0.4 ? 'badge-info' : 'badge-warning'}`}>
                          {(r.efficiency * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {step?.isAnomaly ? <span className="badge-warning"><AlertTriangle className="w-3 h-3 mr-1" />异常</span> : <span className="badge-success">正常</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {expandedRow !== null && (() => {
              const step = stepMap.get(expandedRow)
              if (!step) return null
              return (
                <div className="px-4 py-3 bg-amber-50 border-t border-slate-150">
                  <p className="label-text mb-1">计算追踪 — {step.description}</p>
                  {step.isAnomaly && <p className="text-xs text-amber-600 mb-1">异常原因: {step.anomalyReason}</p>}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <pre className="bg-white rounded p-2 data-cell overflow-auto max-h-28">{JSON.stringify(JSON.parse(step.inputValues), null, 2)}</pre>
                    <pre className="bg-white rounded p-2 data-cell overflow-auto max-h-28">{JSON.stringify(JSON.parse(step.outputValues), null, 2)}</pre>
                  </div>
                </div>
              )
            })()}
          </div>
        </section>
      )}

      {anomalyRecords.length > 0 && (
        <section>
          <h2 className="section-title mb-3">异常样本</h2>
          <div className="card divide-y divide-slate-150">
            {anomalyRecords.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="badge-danger">异常</span>
                  <span className="text-sm text-navy-950 font-medium">{rec.routeId} → {rec.warehouseId}</span>
                  <span className="text-xs text-slate-400">{rec.anomalyReason}</span>
                </div>
                <button className="flex items-center gap-1.5 text-xs" onClick={() => toggleAnomaly(rec.id!, true)}>
                  {rec.isAnomaly ? <ToggleRight className="w-5 h-5 text-amber-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  <span className={rec.isAnomaly ? 'text-amber-600' : 'text-slate-400'}>{rec.isAnomaly ? '已排除' : '已纳入'}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
