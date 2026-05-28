import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, CheckSquare, Square, ArrowUpRight, BarChart3 } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useRef, useEffect, useCallback } from 'react'

function drawHistogram(
  canvas: HTMLCanvasElement,
  values: number[],
  labels: string[],
  barColor: string
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const pad = { top: 20, right: 10, bottom: 30, left: 40 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  ctx.clearRect(0, 0, w, h)
  const max = Math.max(...values, 1)
  const barW = (chartW / values.length) * 0.7
  const gap = (chartW / values.length) * 0.3

  ctx.strokeStyle = '#2D3748'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH * (1 - i / 4)
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(w - pad.right, y)
    ctx.stroke()
    ctx.fillStyle = '#A0AEC0'
    ctx.font = '10px DM Sans'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round((max * i) / 4).toString(), pad.left - 4, y + 3)
  }

  values.forEach((v, i) => {
    const x = pad.left + i * (barW + gap) + gap / 2
    const barH = (v / max) * chartH
    ctx.fillStyle = barColor
    ctx.fillRect(x, pad.top + chartH - barH, barW, barH)
    ctx.fillStyle = '#A0AEC0'
    ctx.font = '9px DM Sans'
    ctx.textAlign = 'center'
    ctx.fillText(labels[i], x + barW / 2, h - 8)
  })
}

function drawColorWheel(
  canvas: HTMLCanvasElement,
  avgHue: number,
  swatchHexes: string[]
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 6

  for (let angle = 0; angle < 360; angle++) {
    const rad = ((angle - 90) * Math.PI) / 180
    const nextRad = ((angle - 89) * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, rad, nextRad)
    ctx.closePath()
    ctx.fillStyle = `hsl(${angle}, 70%, 50%)`
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#0F3460'
  ctx.fill()

  const pointerRad = ((avgHue - 90) * Math.PI) / 180
  const px = cx + Math.cos(pointerRad) * r * 0.75
  const py = cy + Math.sin(pointerRad) * r * 0.75
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#F7F8FC'
  ctx.fill()
  ctx.strokeStyle = '#1A1A2E'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const swatchSize = 8
  const totalW = swatchHexes.length * (swatchSize + 2) - 2
  const startX = cx - totalW / 2
  swatchHexes.forEach((hex, i) => {
    ctx.fillStyle = hex
    ctx.fillRect(
      startX + i * (swatchSize + 2),
      cy - swatchSize / 2,
      swatchSize,
      swatchSize
    )
  })
}

function HistogramChart({
  values,
  labels,
  title,
}: {
  values: number[]
  labels: string[]
  title: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawHistogram(ref.current, values, labels, '#E8A838')
  }, [values, labels])
  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-custom">
      <h4 className="font-body text-text-secondary text-sm mb-2">{title}</h4>
      <canvas ref={ref} width={280} height={160} className="w-full" />
    </div>
  )
}

function MiniColorWheel({
  avgHue,
  swatchHexes,
}: {
  avgHue: number
  swatchHexes: string[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawColorWheel(ref.current, avgHue, swatchHexes)
  }, [avgHue, swatchHexes])
  return <canvas ref={ref} width={80} height={80} className="shrink-0" />
}

export default function Report() {
  const {
    works,
    swatches,
    distances,
    dirtyAlerts,
    clusters,
    pendingRecords,
    togglePending,
  } = useStore()
  const navigate = useNavigate()
  const reportRef = useRef<HTMLDivElement>(null)

  const hueBins = Array(12).fill(0)
  swatches.forEach((s) => {
    hueBins[Math.floor(s.hue / 30) % 12]++
  })
  const hueLabels = Array.from({ length: 12 }, (_, i) => `${i * 30}°`)

  const lightBins = Array(5).fill(0)
  swatches.forEach((s) => {
    lightBins[Math.min(Math.floor(s.lightness / 20), 4)]++
  })
  const lightLabels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']

  const satBins = Array(5).fill(0)
  swatches.forEach((s) => {
    satBins[Math.min(Math.floor(s.saturation / 20), 4)]++
  })
  const satLabels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']

  const distBins = Array(5).fill(0)
  distances.forEach((d) => {
    distBins[Math.min(Math.floor(d.ciede2000 / 10), 4)]++
  })
  const distLabels = ['0-10', '10-20', '20-30', '30-40', '40-50']

  const exportCSV = useCallback(() => {
    const lines: string[] = [
      '类型,作品A,作品B,CIEDE2000,色相距离,明度距离,饱和度距离',
    ]
    distances.forEach((d) => {
      const a = works.find((w) => w.id === d.workAId)
      const b = works.find((w) => w.id === d.workBId)
      lines.push(
        `距离,${a?.title ?? ''},${b?.title ?? ''},${d.ciede2000},${d.hueDistance},${d.lightnessDistance},${d.saturationDistance}`
      )
    })
    lines.push('')
    lines.push('作品ID,标题,学生,色相,饱和度,明度')
    works.forEach((w) => {
      const ws = swatches.filter(
        (s) => s.workId === w.id && !s.isBackground
      )
      const avgH = ws.length
        ? (ws.reduce((s, c) => s + c.hue, 0) / ws.length).toFixed(1)
        : '-'
      const avgS = ws.length
        ? (ws.reduce((s, c) => s + c.saturation, 0) / ws.length).toFixed(1)
        : '-'
      const avgL = ws.length
        ? (ws.reduce((s, c) => s + c.lightness, 0) / ws.length).toFixed(1)
        : '-'
      lines.push(`${w.id},${w.title},${w.studentName},${avgH},${avgS},${avgL}`)
    })
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'color-analysis-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [distances, works, swatches])

  const exportPNG = useCallback(() => {
    if (!reportRef.current) return
    html2canvas(reportRef.current, { backgroundColor: '#1A1A2E' }).then(
      (canvas) => {
        const url = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = 'color-analysis-report.png'
        a.click()
      }
    )
  }, [])

  const workMap = new Map(works.map((w) => [w.id, w]))
  const unresolvedAlerts = dirtyAlerts.filter((a) => !a.resolved)
  const resolvedAlerts = dirtyAlerts.filter((a) => a.resolved)
  const incompleteRecords = pendingRecords.filter((p) => !p.completed)
  const incompleteWorkNames = [
    ...new Set(
      incompleteRecords
        .map((p) => workMap.get(p.workId)?.title)
        .filter(Boolean)
    ),
  ]

  return (
    <div className="min-h-screen bg-bg-primary font-body text-text-primary p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-accent-warm" />
          <h1 className="font-display text-2xl font-bold">分析报告</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-bg-card hover:bg-bg-secondary border border-border-custom text-text-primary px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportPNG}
            className="flex items-center gap-2 bg-accent-warm hover:opacity-90 text-bg-primary font-semibold px-4 py-2 rounded-lg transition-opacity"
          >
            <Download className="w-4 h-4" />
            PNG
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        <section className="mb-10">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-warm" />
            聚类分析
          </h2>
          {clusters.length === 0 ? (
            <p className="text-text-secondary">暂无聚类数据</p>
          ) : (
            <div className="grid gap-4">
              {clusters.map((cluster) => {
                const repSwatches = swatches
                  .filter(
                    (s) =>
                      s.workId === cluster.representativeWorkId &&
                      !s.isBackground
                  )
                  .slice(0, 5)
                return (
                  <div
                    key={cluster.id}
                    className="bg-bg-card border border-border-custom rounded-xl p-5 flex gap-5 items-start"
                  >
                    <MiniColorWheel
                      avgHue={cluster.avgHue}
                      swatchHexes={repSwatches.map((s) => s.hex)}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-base mb-1">
                        {cluster.label}
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        {cluster.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-text-secondary text-xs mb-2">
                        包含作品
                      </p>
                      <ul className="space-y-1">
                        {cluster.workIds.map((wid) => {
                          const w = workMap.get(wid)
                          if (!w) return null
                          return (
                            <li key={wid}>
                              <button
                                onClick={() => navigate(`/work/${wid}`)}
                                className="flex items-center gap-1 text-sm text-accent-warm hover:underline"
                              >
                                {w.title}
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mb-10">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-warm" />
            全局统计
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HistogramChart
              values={hueBins}
              labels={hueLabels}
              title="色相分布"
            />
            <HistogramChart
              values={lightBins}
              labels={lightLabels}
              title="明度分布"
            />
            <HistogramChart
              values={satBins}
              labels={satLabels}
              title="饱和度分布"
            />
            <HistogramChart
              values={distBins}
              labels={distLabels}
              title="距离分布 (CIEDE2000)"
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold mb-4">
            待处理项与结论
          </h2>
          <div className="bg-bg-card border border-border-custom rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-custom text-text-secondary text-left">
                  <th className="p-3 w-10"></th>
                  <th className="p-3">作品</th>
                  <th className="p-3">缺失字段</th>
                  <th className="p-3">备注</th>
                </tr>
              </thead>
              <tbody>
                {pendingRecords.map((p) => {
                  const w = workMap.get(p.workId)
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border-custom ${p.completed ? 'opacity-50' : ''}`}
                    >
                      <td className="p-3">
                        <button onClick={() => togglePending(p.id)}>
                          {p.completed ? (
                            <CheckSquare className="w-4 h-4 text-accent-green" />
                          ) : (
                            <Square className="w-4 h-4 text-text-secondary" />
                          )}
                        </button>
                      </td>
                      <td
                        className={`p-3 ${p.completed ? 'line-through text-text-secondary' : ''}`}
                      >
                        {w?.title ?? p.workId}
                      </td>
                      <td className="p-3 text-text-secondary">
                        {p.missingField}
                      </td>
                      <td className="p-3 text-text-secondary">{p.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-bg-secondary border border-border-custom rounded-xl p-5">
            <h3 className="font-display font-bold mb-3">结论</h3>
            <div className="text-text-secondary text-sm leading-relaxed space-y-2">
              <p>
                本次分析共涵盖{' '}
                <span className="text-accent-warm font-semibold">
                  {works.length}
                </span>{' '}
                件作品，通过聚类算法识别出{' '}
                <span className="text-accent-warm font-semibold">
                  {clusters.length}
                </span>{' '}
                个色彩聚类。
              </p>
              <p>
                数据质量检测发现{' '}
                <span className="text-accent-warm font-semibold">
                  {dirtyAlerts.length}
                </span>{' '}
                个异常问题，其中{' '}
                <span className="text-accent-green font-semibold">
                  {resolvedAlerts.length}
                </span>{' '}
                个已解决，{' '}
                <span
                  className={
                    unresolvedAlerts.length > 0
                      ? 'text-critical font-semibold'
                      : 'text-accent-green font-semibold'
                  }
                >
                  {unresolvedAlerts.length}
                </span>{' '}
                个待处理。
              </p>
              <p>
                当前尚有{' '}
                <span className="text-accent-warm font-semibold">
                  {incompleteRecords.length}
                </span>{' '}
                项待完成记录
                {incompleteWorkNames.length > 0 && (
                  <>
                    （涉及作品：
                    <span className="text-accent-warm">
                      {incompleteWorkNames.join('、')}
                    </span>
                    ）
                  </>
                )}
                。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
