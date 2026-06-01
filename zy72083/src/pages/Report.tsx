import { useState, useMemo, useRef } from 'react'
import { Printer, Download, Clock, GitBranch, FileText } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar, Scatter } from 'react-chartjs-2'
import { useStore } from '@/store'
import { betaPdf, normalPdf } from '@/utils/bayesian'
import type { PosteriorResult, SupplementDiff, Observation } from '@/utils/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

function HistorySidebar({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const computations = useStore(s => s.computations)
  const batches = useStore(s => s.batches)

  return (
    <aside className="w-64 shrink-0 bg-bg-card rounded-xl border border-border p-4 overflow-y-auto max-h-[80vh]">
      <h3 className="text-text-primary font-bold text-sm mb-3">计算历史</h3>
      {computations.length === 0 && (
        <p className="text-xs text-text-muted">暂无计算记录</p>
      )}
      <ul className="space-y-2">
        {computations.map(c => {
          const batch = batches.find(b => b.batchId === c.batchId)
          return (
            <li key={c.computeId}>
              <button
                type="button"
                onClick={() => onSelect(c.computeId)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selectedId === c.computeId
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <p className="font-medium truncate">{c.computeId}</p>
                <p className="text-xs opacity-70 mt-0.5">{c.computedAt}</p>
                {batch && <p className="text-xs opacity-60 mt-0.5 truncate">批次: {batch.note || batch.batchId}</p>}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function PriorPosteriorChart({ result }: { result: PosteriorResult }) {
  const prior = result.priorSnapshot
  const post = result.posteriorParams

  const data = useMemo(() => {
    if (prior.type === 'beta' && post.type === 'beta') {
      const xs = Array.from({ length: 200 }, (_, i) => i / 199)
      return {
        labels: xs.map(x => x.toFixed(2)),
        datasets: [
          {
            label: '先验 Beta',
            data: xs.map(x => betaPdf(x, prior.alpha, prior.beta)),
            borderColor: '#64748b',
            backgroundColor: 'rgba(100,116,139,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: '后验 Beta',
            data: xs.map(x => betaPdf(x, post.alpha, post.beta)),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      }
    }
    const mu0 = prior.mu ?? 0
    const s0 = Math.sqrt(prior.sigma2 ?? 1)
    const mu1 = post.mu ?? 0
    const s1 = Math.sqrt(post.sigma2 ?? 1)
    const lo = Math.min(mu0 - 4 * s0, mu1 - 4 * s1)
    const hi = Math.max(mu0 + 4 * s0, mu1 + 4 * s1)
    const xs = Array.from({ length: 200 }, (_, i) => lo + (hi - lo) * i / 199)
    return {
      labels: xs.map(x => x.toFixed(3)),
      datasets: [
        {
          label: '先验 Normal',
          data: xs.map(x => normalPdf(x, mu0, s0 * s0)),
          borderColor: '#64748b',
          backgroundColor: 'rgba(100,116,139,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: '后验 Normal',
          data: xs.map(x => normalPdf(x, mu1, s1 * s1)),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }
  }, [prior, post])

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">先验/后验分布对比图</h3>
      <Line data={data} options={{
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(51,65,85,0.5)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.5)' } },
        },
      }} />
    </div>
  )
}

function ChannelRateChart({ observations }: { observations: Observation[] }) {
  const data = useMemo(() => {
    const channels = observations.map(o => o.channel)
    const rates = observations.map(o => o.clicks > 0 ? o.conversions / o.clicks : 0)
    return {
      labels: channels,
      datasets: [{
        label: '转化率',
        data: rates,
        backgroundColor: observations.map(o =>
          o.isOutlier ? 'rgba(239,68,68,0.7)' : 'rgba(245,158,11,0.7)'
        ),
        borderColor: observations.map(o =>
          o.isOutlier ? '#ef4444' : '#f59e0b'
        ),
        borderWidth: 1,
        borderRadius: 4,
      }],
    }
  }, [observations])

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">各渠道转化率柱状图</h3>
      <Bar data={data} options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.5)' }, title: { display: true, text: '转化率', color: '#64748b' } },
        },
      }} />
    </div>
  )
}

function OutlierScatterChart({ observations, onPointClick }: { observations: Observation[]; onPointClick: (idx: number) => void }) {
  const data = useMemo(() => ({
    datasets: [{
      label: '样本',
      data: observations.map((o, i) => ({ x: o.impressions, y: o.conversions, _idx: i })),
      backgroundColor: observations.map(o => o.isOutlier ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.6)'),
      borderColor: observations.map(o => o.isOutlier ? '#ef4444' : '#3b82f6'),
      pointRadius: observations.map(o => o.isOutlier ? 8 : 5),
      pointHoverRadius: 10,
    }],
  }), [observations])

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">越界样本散点图</h3>
      <Scatter data={data} options={{
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `曝光: ${ctx.parsed.x}, 转化: ${ctx.parsed.y}` } } },
        scales: {
          x: { title: { display: true, text: '曝光量', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.5)' } },
          y: { title: { display: true, text: '转化量', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.5)' } },
        },
        onClick: (_e, elements) => {
          if (elements.length > 0) {
            const idx = (elements[0] as { index: number }).index
            onPointClick(idx)
          }
        },
      }} />
    </div>
  )
}

function ObservationDetailTable({ observations, highlightIdx }: { observations: Observation[]; highlightIdx: number | null }) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  if (observations.length === 0) return null

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">观测明细</h3>
      <div className="overflow-x-auto rounded-lg border border-border max-h-[300px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0">
            <tr className="bg-bg-secondary text-text-muted text-xs">
              <th className="px-3 py-2">渠道</th>
              <th className="px-3 py-2 text-right">曝光量</th>
              <th className="px-3 py-2 text-right">点击量</th>
              <th className="px-3 py-2 text-right">转化量</th>
              <th className="px-3 py-2">单位</th>
              <th className="px-3 py-2 text-right">权重</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2">异常</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {observations.map((o, i) => (
              <tr
                key={o.obsId}
                ref={el => { rowRefs.current[i] = el }}
                className={`transition-colors ${
                  highlightIdx === i ? 'bg-info-bg' : o.isOutlier ? 'bg-danger-bg' : 'hover:bg-bg-hover'
                }`}
              >
                <td className="px-3 py-2 text-sm text-text-primary">{o.channel}</td>
                <td className="px-3 py-2 text-sm font-mono text-right">{o.impressions.toLocaleString()}</td>
                <td className="px-3 py-2 text-sm font-mono text-right">{o.clicks.toLocaleString()}</td>
                <td className="px-3 py-2 text-sm font-mono text-right">{o.conversions.toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-text-secondary">{o.unit}</td>
                <td className="px-3 py-2 text-sm font-mono text-right">{o.weight.toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-text-secondary max-w-[100px] truncate">{o.source}</td>
                <td className="px-3 py-2 text-xs text-text-secondary max-w-[100px] truncate">{o.note}</td>
                <td className="px-3 py-2 text-xs">{o.isOutlier ? <span className="text-danger">是</span> : <span className="text-text-muted">否</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SupplementDiffPanel({ supplements }: { supplements: SupplementDiff[] }) {
  if (supplements.length === 0) return null
  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">补录差异对比</h3>
      <div className="space-y-4">
        {supplements.map(sup => (
          <div key={sup.supplementId} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-bg-secondary px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {sup.supplementedBy} · {sup.supplementedAt}
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-4">
                <p className="text-xs text-text-muted mb-2 font-medium">补录前</p>
                <div className="space-y-1 text-sm font-mono">
                  <p className="text-text-secondary">均值: {sup.before.posteriorMean.toFixed(6)}</p>
                  <p className="text-text-secondary">标准差: {sup.before.posteriorStd.toFixed(6)}</p>
                  <p className="text-text-secondary">95%CI: [{sup.before.credibleLower.toFixed(4)}, {sup.before.credibleUpper.toFixed(4)}]</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-text-muted mb-2 font-medium">补录后</p>
                <div className="space-y-1 text-sm font-mono">
                  <p className="text-text-primary">均值: {sup.after.posteriorMean.toFixed(6)}</p>
                  <p className="text-text-primary">标准差: {sup.after.posteriorStd.toFixed(6)}</p>
                  <p className="text-text-primary">95%CI: [{sup.after.credibleLower.toFixed(4)}, {sup.after.credibleUpper.toFixed(4)}]</p>
                </div>
              </div>
            </div>
            {sup.changedFields.length > 0 && (
              <div className="border-t border-border">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-bg-secondary text-text-muted text-xs">
                      <th className="px-4 py-1.5">字段</th>
                      <th className="px-4 py-1.5 text-right">变化前</th>
                      <th className="px-4 py-1.5 text-right">变化后</th>
                      <th className="px-4 py-1.5 text-right">差异</th>
                      <th className="px-4 py-1.5">原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sup.changedFields.map((cf, i) => (
                      <tr key={i} className="bg-info-bg">
                        <td className="px-4 py-1.5 text-xs text-text-primary">{cf.field}</td>
                        <td className="px-4 py-1.5 text-xs font-mono text-right text-text-secondary">{cf.before.toFixed(6)}</td>
                        <td className="px-4 py-1.5 text-xs font-mono text-right text-text-primary">{cf.after.toFixed(6)}</td>
                        <td className="px-4 py-1.5 text-xs font-mono text-right text-info">{cf.delta >= 0 ? '+' : ''}{cf.delta.toFixed(6)}</td>
                        <td className="px-4 py-1.5 text-xs text-text-secondary">{cf.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProvenanceSection({ result }: { result: PosteriorResult }) {
  const supplements = useStore(s => s.supplements)
  const relatedSupps = supplements.filter(s => s.computeId === result.computeId)

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-text-primary font-bold text-sm mb-3">来源追溯</h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4 text-text-muted" />
          <span>计算时间: <strong className="text-text-primary font-mono">{result.computedAt}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <GitBranch className="w-4 h-4 text-text-muted" />
          <span>批次ID: <strong className="text-text-primary font-mono">{result.batchId}</strong></span>
        </div>
        <div className="mt-3">
          <p className="text-xs text-text-muted mb-2">各观测来源:</p>
          <ul className="space-y-1">
            {result.observations.map(o => (
              <li key={o.obsId} className="flex items-center gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="text-text-primary">{o.channel}</span>
                <span className="text-text-muted">—</span>
                <span className="text-text-secondary">{o.source}</span>
              </li>
            ))}
          </ul>
        </div>
        {relatedSupps.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs text-text-muted mb-2">补录历史:</p>
            <ul className="space-y-1">
              {relatedSupps.map(s => (
                <li key={s.supplementId} className="text-xs text-text-secondary">
                  {s.supplementedAt} · {s.supplementedBy} · 变更 {s.changedFields.length} 项
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Report() {
  const computations = useStore(s => s.computations)
  const supplements = useStore(s => s.supplements)
  const exportData = useStore(s => s.exportData)
  const [selectedId, setSelectedId] = useState('')
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)

  const selected = useMemo(() => computations.find(c => c.computeId === selectedId) ?? null, [computations, selectedId])
  const relatedSupps = useMemo(() => supplements.filter(s => s.computeId === selectedId), [supplements, selectedId])

  const handleExportJSON = () => {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bayesian-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  return (
    <div className="flex gap-6 max-w-7xl mx-auto print-friendly">
      <HistorySidebar selectedId={selectedId} onSelect={id => { setSelectedId(id); setHighlightIdx(null) }} />
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-text-primary font-bold text-xl">查看报告</h1>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover text-sm transition-colors">
              <Printer className="w-4 h-4" />
              打印报告
            </button>
            <button type="button" onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />
              导出 JSON
            </button>
          </div>
        </div>

        {!selected && (
          <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
            <p className="text-text-muted">请从左侧选择一条计算记录查看报告</p>
          </div>
        )}

        {selected && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <PriorPosteriorChart result={selected} />
              <ChannelRateChart observations={selected.observations} />
            </div>
            <OutlierScatterChart observations={selected.observations} onPointClick={setHighlightIdx} />
            <ObservationDetailTable observations={selected.observations} highlightIdx={highlightIdx} />
            <SupplementDiffPanel supplements={relatedSupps} />
            <ProvenanceSection result={selected} />
          </>
        )}
      </div>
    </div>
  )
}
