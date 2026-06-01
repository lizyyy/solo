import { useState, useMemo } from 'react'
import { Trash2, ChevronDown, ChevronUp, ChevronRight, AlertTriangle, Info } from 'lucide-react'
import { useStore } from '@/store'
import { generateId } from '@/utils/bayesian'
import type { Observation, AdUnit, BoundaryConfig } from '@/utils/types'

const inputCls = 'w-28 px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm font-mono'
const formInputCls = 'px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm font-mono'
const labelCls = 'flex flex-col gap-1'

function PriorParamsSection() {
  const priorParams = useStore(s => s.priorParams)
  const setPriorParams = useStore(s => s.setPriorParams)
  const isBeta = priorParams.type === 'beta'

  const explanation = useMemo(() => {
    if (isBeta) {
      const { alpha, beta } = priorParams
      const mean = (alpha / (alpha + beta)).toFixed(4)
      if (alpha === 1 && beta === 1) return `Beta(1, 1) 表示你对转化率没有任何先验看法，相当于均匀分布`
      const dir = alpha > beta ? '偏向高转化率' : alpha < beta ? '偏向低转化率' : ''
      return `Beta(${alpha}, ${beta}) ${dir}，均值为 ${mean}`
    }
    return `正态 N(${priorParams.mu ?? 0}, ${priorParams.sigma2 ?? 1})，均值 ${priorParams.mu ?? 0}，标准差 ${Math.sqrt(priorParams.sigma2 ?? 1).toFixed(4)}`
  }, [priorParams, isBeta])

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-4">先验参数设置</h2>
      <div className="flex gap-6 mb-4">
        {([['beta', 'Beta分布（转化率场景）'], ['normal', '正态分布（均值场景）']] as const).map(([val, label]) => (
          <label key={val} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="priorType" checked={priorParams.type === val}
              onChange={() => setPriorParams(val === 'beta'
                ? { type: 'beta', alpha: priorParams.alpha, beta: priorParams.beta }
                : { type: 'normal', alpha: 0, beta: 0, mu: priorParams.mu ?? 0, sigma2: priorParams.sigma2 ?? 1 })}
              className="accent-accent" />
            <span className="text-sm text-text-primary">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-4 mb-3">
        {isBeta ? (
          <>
            <label className={labelCls}>
              <span className="text-xs text-text-muted">α (成功次数)</span>
              <input type="number" min={0.01} step={1} value={priorParams.alpha}
                onChange={e => setPriorParams({ ...priorParams, alpha: Number(e.target.value) })} className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className="text-xs text-text-muted">β (失败次数)</span>
              <input type="number" min={0.01} step={1} value={priorParams.beta}
                onChange={e => setPriorParams({ ...priorParams, beta: Number(e.target.value) })} className={inputCls} />
            </label>
          </>
        ) : (
          <>
            <label className={labelCls}>
              <span className="text-xs text-text-muted">μ (均值)</span>
              <input type="number" step={0.01} value={priorParams.mu ?? 0}
                onChange={e => setPriorParams({ ...priorParams, mu: Number(e.target.value) })} className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className="text-xs text-text-muted">σ² (方差)</span>
              <input type="number" min={0.001} step={0.01} value={priorParams.sigma2 ?? 1}
                onChange={e => setPriorParams({ ...priorParams, sigma2: Number(e.target.value) })} className={inputCls} />
            </label>
          </>
        )}
      </div>
      <div className="flex items-start gap-2 text-xs text-text-muted bg-bg-secondary rounded-lg px-3 py-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-info" />
        <span>{explanation}</span>
      </div>
    </section>
  )
}

function ObservationRow({ obs, batchId }: { obs: Observation; batchId: string }) {
  const removeObservation = useStore(s => s.removeObservation)
  const [expanded, setExpanded] = useState(false)
  const outCls = obs.isOutlier ? 'bg-danger-bg border-l-4 border-l-danger' : 'border-l-4 border-l-transparent'

  return (
    <>
      <tr className={`${outCls} hover:bg-bg-hover transition-colors`}>
        <td className="px-3 py-2 text-sm text-text-primary">{obs.channel}</td>
        <td className="px-3 py-2 text-sm font-mono text-right">{obs.impressions.toLocaleString()}</td>
        <td className="px-3 py-2 text-sm font-mono text-right">{obs.clicks.toLocaleString()}</td>
        <td className="px-3 py-2 text-sm font-mono text-right">{obs.conversions.toLocaleString()}</td>
        <td className="px-3 py-2 text-sm text-text-secondary">{obs.unit}</td>
        <td className="px-3 py-2 text-sm font-mono text-right">{obs.weight.toFixed(2)}</td>
        <td className="px-3 py-2 text-sm text-text-secondary max-w-[120px] truncate">{obs.source}</td>
        <td className="px-3 py-2 text-sm text-text-secondary max-w-[120px] truncate">{obs.note}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setExpanded(v => !v)} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => removeObservation(batchId, obs.obsId)} className="p-1 rounded hover:bg-danger-bg text-text-muted hover:text-danger transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className={obs.isOutlier ? 'bg-danger-bg' : 'bg-bg-secondary'}>
          <td colSpan={9} className="px-6 py-3 text-xs text-text-secondary leading-relaxed">
            <div className="flex flex-col gap-1">
              <span><strong className="text-text-muted">来源：</strong>{obs.source}</span>
              <span><strong className="text-text-muted">备注：</strong>{obs.note}</span>
              <span><strong className="text-text-muted">录入时间：</strong>{obs.recordedAt}</span>
              {obs.isOutlier && <span className="text-danger"><strong>异常原因：</strong>{obs.outlierReason}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ObservationTable() {
  const batch = useStore(s => s.batches[0])
  if (!batch) return null
  const thCls = (right?: boolean) => `px-3 py-2 font-medium ${right ? 'text-right' : ''}`

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-2">观测数据表</h2>
      <div className="flex items-center gap-4 mb-4 text-xs text-text-muted">
        <span>批次: <strong className="text-text-secondary font-mono">{batch.batchId}</strong></span>
        <span>创建: <strong className="text-text-secondary">{batch.createdAt}</strong></span>
        <span>操作人: <strong className="text-text-secondary">{batch.operatorName}</strong></span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bg-secondary text-text-muted text-xs">
              <th className={thCls()}>渠道</th><th className={thCls(true)}>曝光量</th>
              <th className={thCls(true)}>点击量</th><th className={thCls(true)}>转化量</th>
              <th className={thCls()}>单位</th><th className={thCls(true)}>权重</th>
              <th className={thCls()}>来源</th><th className={thCls()}>备注</th>
              <th className={`${thCls()} w-20`}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {batch.observations.map(obs => <ObservationRow key={obs.obsId} obs={obs} batchId={batch.batchId} />)}
            {batch.observations.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-text-muted text-sm">暂无观测数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function NewObservationForm() {
  const addObservation = useStore(s => s.addObservation)
  const batch = useStore(s => s.batches[0])
  const [form, setForm] = useState({ channel: '', impressions: '', clicks: '', conversions: '', unit: 'CPM' as AdUnit, weight: '', source: '', note: '' })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const unitMismatch = useMemo(() => {
    if (!batch) return false
    const existing = new Set(batch.observations.map(o => o.unit))
    return existing.size > 0 && !existing.has(form.unit)
  }, [batch, form.unit])

  const weightSum = useMemo(() => {
    if (!batch) return 0
    return batch.observations.reduce((s, o) => s + o.weight, 0) + (Number(form.weight) || 0)
  }, [batch, form.weight])

  const resetForm = () => setForm({ channel: '', impressions: '', clicks: '', conversions: '', unit: 'CPM', weight: '', source: '', note: '' })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!batch) return
    addObservation(batch.batchId, {
      obsId: generateId(), channel: form.channel, impressions: Number(form.impressions),
      clicks: Number(form.clicks), conversions: Number(form.conversions), unit: form.unit,
      weight: Number(form.weight), source: form.source, recordedAt: new Date().toLocaleString('zh-CN'),
      note: form.note, isOutlier: false, outlierReason: '',
    })
    resetForm()
  }

  const existingUnits = batch?.observations.map(o => o.unit).filter((v, i, a) => a.indexOf(v) === i).join('/') ?? ''
  const weightDiff = (1 - weightSum)

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-4">新增观测</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <label className={labelCls}><span className="text-xs text-text-muted">渠道</span>
            <input required value={form.channel} onChange={e => set('channel', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">曝光量</span>
            <input required type="number" min={0} value={form.impressions} onChange={e => set('impressions', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">点击量</span>
            <input required type="number" min={0} value={form.clicks} onChange={e => set('clicks', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">转化量</span>
            <input required type="number" min={0} value={form.conversions} onChange={e => set('conversions', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">单位</span>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className={formInputCls}>
              {([['CPM', 'CPM'], ['CPC', 'CPC'], ['CPA', 'CPA']] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <label className={labelCls}><span className="text-xs text-text-muted">权重</span>
            <input required type="number" min={0} max={1} step={0.01} value={form.weight} onChange={e => set('weight', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">来源</span>
            <input value={form.source} onChange={e => set('source', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">备注</span>
            <textarea rows={1} value={form.note} onChange={e => set('note', e.target.value)} className={`${formInputCls} resize-none`} /></label>
        </div>
        {unitMismatch && (
          <div className="flex items-center gap-2 text-xs text-warning bg-warning-bg rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>单位不一致：当前批次已有 {existingUnits} 的数据，新观测为 {form.unit}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">
            当前权重合计: <strong className="font-mono">{weightSum.toFixed(2)}</strong>
            <span className={`ml-2 ${Math.abs(weightDiff) > 0.01 ? 'text-warning' : 'text-success'}`}>
              (差额: {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(2)})
            </span>
          </span>
          <button type="submit" className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">添加观测</button>
        </div>
      </form>
    </section>
  )
}

const BOUNDARY_LABELS: Record<keyof BoundaryConfig, { label: string; hint: string }> = {
  maxAlpha: { label: 'α 上限', hint: '后验 α 超过此值时报警，防止先验被大量数据淹没' },
  maxBeta: { label: 'β 上限', hint: '后验 β 超过此值时报警，同上' },
  maxMu: { label: 'μ 上限', hint: '正态后验均值超过此值时报警，防止异常漂移' },
  maxSigma2: { label: 'σ² 上限', hint: '后验方差超过此值时报警，表示不确定性过大' },
  minConversions: { label: '转化数下限', hint: '单条观测转化数低于此值时警告' },
  maxConversions: { label: '转化数上限', hint: '单条观测转化数超过此值时报警' },
  outlierStdThreshold: { label: '异常标准差倍数', hint: '偏离均值超过此倍标准差的数据标记为异常，通常设为2~4' },
}

function BoundaryConfigSection() {
  const config = useStore(s => s.boundaryConfig)
  const setConfig = useStore(s => s.setBoundaryConfig)
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-bg-hover transition-colors">
        <h2 className="text-text-primary font-bold text-base">边界配置</h2>
        <ChevronRight className={`w-5 h-5 text-text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 animate-fade-in">
          {(Object.entries(BOUNDARY_LABELS) as [keyof BoundaryConfig, typeof BOUNDARY_LABELS[keyof BoundaryConfig]][]).map(([key, { label, hint }]) => (
            <div key={key} className="flex items-start gap-4">
              <label className="flex flex-col gap-1 w-40 shrink-0">
                <span className="text-sm text-text-primary">{label}</span>
                <input type="number"
                  step={key === 'outlierStdThreshold' ? 0.5 : key === 'maxMu' || key === 'maxSigma2' ? 0.1 : 100}
                  value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })}
                  className={formInputCls} />
              </label>
              <span className="text-xs text-text-muted pt-6 leading-relaxed">{hint}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function DataEntry() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-accent rounded-full" />
        <div>
          <h1 className="text-text-primary font-bold text-xl">数据录入</h1>
          <p className="text-xs text-text-muted mt-0.5">录入先验参数和观测数据，系统会自动检测单位和边界问题</p>
        </div>
      </div>
      <PriorParamsSection />
      <ObservationTable />
      <NewObservationForm />
      <BoundaryConfigSection />
    </div>
  )
}
