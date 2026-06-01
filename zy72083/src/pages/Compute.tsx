import { useState, useMemo } from 'react'
import { Play, Plus } from 'lucide-react'
import { useStore } from '@/store'
import { generateId } from '@/utils/bayesian'
import WarningBanner from '@/components/WarningBanner'
import type { Observation, AdUnit, PosteriorResult, SupplementDiff } from '@/utils/types'

const formInputCls = 'px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm font-mono'
const labelCls = 'flex flex-col gap-1'

function formatAdaptive(n: number): string {
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs < 0.0001) return n.toFixed(8)
  if (abs < 0.01) return n.toFixed(6)
  if (abs < 1) return n.toFixed(4)
  return n.toFixed(2)
}

function BatchSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const batches = useStore(s => s.batches)
  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-4">批次选择</h2>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${formInputCls} w-full max-w-md`}>
        <option value="">-- 请选择批次 --</option>
        {batches.map(b => (
          <option key={b.batchId} value={b.batchId}>
            {b.batchId}（{b.observations.length} 条观测，创建于 {b.createdAt}）
          </option>
        ))}
      </select>
    </section>
  )
}

function FormulaDisplay({ priorType }: { priorType: 'beta' | 'normal' }) {
  const priorParams = useStore(s => s.priorParams)
  if (priorType === 'beta') {
    return (
      <section className="bg-bg-card rounded-xl border border-border p-5">
        <h2 className="text-text-primary font-bold text-base mb-4">公式展示</h2>
        <div className="bg-bg-secondary rounded-lg p-4 space-y-3">
          <p className="text-text-primary font-mono text-sm">
            先验: Beta(α₀={priorParams.alpha}, β₀={priorParams.beta})
          </p>
          <p className="text-text-primary font-mono text-sm">
            ↓ 加上观测数据 (s次转化, f次未转化)
          </p>
          <p className="text-text-primary font-mono text-sm">
            后验: Beta(α₀+s, β₀+f)
          </p>
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">α₀</strong> (先验成功次数，即先验认为转化了多少次)
            </p>
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">β₀</strong> (先验失败次数，即先验认为未转化了多少次)
            </p>
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">s</strong> (本次观测的总转化次数)
            </p>
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">f</strong> (本次观测的总未转化次数 = 点击量 - 转化量)
            </p>
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-4">公式展示</h2>
      <div className="bg-bg-secondary rounded-lg p-4 space-y-3">
        <p className="text-text-primary font-mono text-sm">
          先验: N(μ₀={priorParams.mu ?? 0}, σ₀²={priorParams.sigma2 ?? 1})
        </p>
        <p className="text-text-primary font-mono text-sm">
          ↓ 加上 n 个观测
        </p>
        <p className="text-text-primary font-mono text-sm">
          后验: N(μₙ, σₙ²)
        </p>
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">μ₀</strong> (先验均值，你对转化率的初始估计)
          </p>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">σ₀²</strong> (先验方差，你初始估计的不确定性)
          </p>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">μₙ</strong> (后验均值 = 先验与数据的加权平均)
          </p>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">σₙ²</strong> (后验方差 = 数据增加后不确定性降低)
          </p>
        </div>
      </div>
    </section>
  )
}

function ComputeTrigger({ batchId, onComputed }: { batchId: string; onComputed: (r: PosteriorResult) => void }) {
  const runComputation = useStore(s => s.runComputation)
  const disabled = !batchId

  const handleClick = () => {
    if (!batchId) return
    const result = runComputation(batchId)
    if (result) onComputed(result)
  }

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          运行贝叶斯更新
        </button>
        {disabled && (
          <span className="text-xs text-text-muted">请先选择一个批次</span>
        )}
      </div>
    </section>
  )
}

function ResultDisplay({ result }: { result: PosteriorResult }) {
  const prior = result.priorSnapshot
  const post = result.posteriorParams

  const paramRows = useMemo(() => {
    if (prior.type === 'beta' && post.type === 'beta') {
      return [
        { label: 'α (成功次数)', prior: prior.alpha, post: post.alpha },
        { label: 'β (失败次数)', prior: prior.beta, post: post.beta },
      ]
    }
    return [
      { label: 'μ (均值)', prior: prior.mu ?? 0, post: post.mu ?? 0 },
      { label: 'σ² (方差)', prior: prior.sigma2 ?? 1, post: post.sigma2 ?? 1 },
    ]
  }, [prior, post])

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5 animate-fade-in">
      <h2 className="text-text-primary font-bold text-base mb-4">计算结果</h2>

      <div className="overflow-x-auto rounded-lg border border-border mb-5">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bg-secondary text-text-muted text-xs">
              <th className="px-4 py-2">参数</th>
              <th className="px-4 py-2 text-right">先验</th>
              <th className="px-4 py-2 text-right">后验</th>
              <th className="px-4 py-2 text-right">变化</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paramRows.map(r => (
              <tr key={r.label} className="hover:bg-bg-hover transition-colors">
                <td className="px-4 py-2 text-sm text-text-primary">{r.label}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-text-secondary">{r.prior.toFixed(4)}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-text-primary">{r.post.toFixed(4)}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-info">
                  {(r.post - r.prior) >= 0 ? '+' : ''}{(r.post - r.prior).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-bg-secondary rounded-lg p-4 border border-border/50">
          <p className="text-xs text-text-muted mb-1">后验均值</p>
          <p className="text-xl font-mono text-accent font-bold">{result.posteriorMean.toFixed(6)}</p>
          <p className="text-xs text-text-muted mt-1">即更新后对转化率的最佳估计</p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border/50">
          <p className="text-xs text-text-muted mb-1">后验标准差</p>
          <p className="text-xl font-mono text-text-primary font-bold">{result.posteriorStd.toFixed(6)}</p>
          <p className="text-xs text-text-muted mt-1">不确定性，越小越确定</p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border/50">
          <p className="text-xs text-text-muted mb-1">95% 可信区间</p>
          <p className="text-xl font-mono text-success font-bold">
            [{formatAdaptive(result.credibleLower)}, {formatAdaptive(result.credibleUpper)}]
          </p>
          <p className="text-xs text-text-muted mt-1">有95%概率真实值在此范围内</p>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-2 mb-2">
          <h3 className="text-sm font-medium text-text-secondary">警告信息</h3>
          {result.warnings.map((w, i) => (
            <WarningBanner key={i} warning={w} />
          ))}
        </div>
      )}
    </section>
  )
}

function SupplementForm({ computeId, onSupplemented }: { computeId: string; onSupplemented: (d: SupplementDiff) => void }) {
  const runSupplement = useStore(s => s.runSupplement)
  const [form, setForm] = useState({
    channel: '', impressions: '', clicks: '', conversions: '',
    unit: 'CPM' as AdUnit, weight: '', source: '', note: '', operatorName: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newObs: Observation = {
      obsId: generateId(),
      channel: form.channel,
      impressions: Number(form.impressions),
      clicks: Number(form.clicks),
      conversions: Number(form.conversions),
      unit: form.unit,
      weight: Number(form.weight),
      source: form.source,
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: form.note,
      isOutlier: false,
      outlierReason: '',
    }
    const diff = runSupplement(computeId, newObs, form.operatorName || '调度主管')
    if (diff) onSupplemented(diff)
  }

  return (
    <section className="bg-bg-card rounded-xl border border-border p-5">
      <h2 className="text-text-primary font-bold text-base mb-4">
        <Plus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
        补录备注
      </h2>
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
              {(['CPM', 'CPC', 'CPA'] as const).map(v => <option key={v} value={v}>{v}</option>)}
            </select></label>
          <label className={labelCls}><span className="text-xs text-text-muted">权重</span>
            <input required type="number" min={0} max={1} step={0.01} value={form.weight} onChange={e => set('weight', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">来源</span>
            <input value={form.source} onChange={e => set('source', e.target.value)} className={formInputCls} /></label>
          <label className={labelCls}><span className="text-xs text-text-muted">备注</span>
            <textarea rows={1} value={form.note} onChange={e => set('note', e.target.value)} className={`${formInputCls} resize-none`} /></label>
        </div>
        <div className="flex items-center justify-between">
          <label className={`${labelCls} flex-row items-center gap-2`}>
            <span className="text-xs text-text-muted">操作人</span>
            <input value={form.operatorName} onChange={e => set('operatorName', e.target.value)}
              placeholder="调度主管" className={`${formInputCls} w-32`} />
          </label>
          <button type="submit" className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
            提交补录
          </button>
        </div>
      </form>
    </section>
  )
}

function SupplementDiffDisplay({ diff }: { diff: SupplementDiff }) {
  return (
    <section className="bg-bg-card rounded-xl border border-border p-5 animate-fade-in">
      <h2 className="text-text-primary font-bold text-base mb-2">补录差异对比</h2>
      <p className="text-xs text-text-muted mb-4">
        由 <strong className="text-text-secondary">{diff.supplementedBy}</strong> 于 {diff.supplementedAt} 补录
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bg-secondary text-text-muted text-xs">
              <th className="px-4 py-2">字段</th>
              <th className="px-4 py-2 text-right">补录前</th>
              <th className="px-4 py-2 text-right">补录后</th>
              <th className="px-4 py-2 text-right">变化量</th>
              <th className="px-4 py-2">原因</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {diff.changedFields.map((cf, i) => (
              <tr key={i} className="bg-info-bg hover:bg-bg-hover transition-colors">
                <td className="px-4 py-2 text-sm text-text-primary">{cf.field}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-text-secondary">{cf.before.toFixed(6)}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-text-primary">{cf.after.toFixed(6)}</td>
                <td className="px-4 py-2 text-sm font-mono text-right text-info">
                  {cf.delta >= 0 ? '+' : ''}{cf.delta.toFixed(6)}
                </td>
                <td className="px-4 py-2 text-xs text-text-secondary max-w-[240px]">{cf.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function Compute() {
  const priorParams = useStore(s => s.priorParams)
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [latestResult, setLatestResult] = useState<PosteriorResult | null>(null)
  const [latestDiff, setLatestDiff] = useState<SupplementDiff | null>(null)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-accent rounded-full" />
        <div>
          <h1 className="text-text-primary font-bold text-xl">贝叶斯计算</h1>
          <p className="text-xs text-text-muted mt-0.5">选择批次，运行贝叶斯更新，查看先验→后验变化</p>
        </div>
      </div>

      <BatchSelector value={selectedBatchId} onChange={setSelectedBatchId} />

      {selectedBatchId && (
        <FormulaDisplay priorType={priorParams.type} />
      )}

      <ComputeTrigger
        batchId={selectedBatchId}
        onComputed={r => { setLatestResult(r); setLatestDiff(null) }}
      />

      {latestResult && <ResultDisplay result={latestResult} />}

      {latestResult && (
        <SupplementForm
          computeId={latestResult.computeId}
          onSupplemented={d => setLatestDiff(d)}
        />
      )}

      {latestDiff && <SupplementDiffDisplay diff={latestDiff} />}
    </div>
  )
}
