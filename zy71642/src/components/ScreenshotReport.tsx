import { useState } from 'react'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getMolecule, getOrbital } from '@/data/molecules'
import { Camera, Download, X, FileText } from 'lucide-react'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':')
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${formatTime(ts)}`
}

export default function ScreenshotReport() {
  const screenshots = useOrbitalStore((s) => s.screenshots)
  const addScreenshot = useOrbitalStore((s) => s.addScreenshot)
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const showNodePlanes = useOrbitalStore((s) => s.showNodePlanes)
  const showSection = useOrbitalStore((s) => s.showSection)
  const isosurfaceThreshold = useOrbitalStore((s) => s.isosurfaceThreshold)
  const nodePlaneOpacity = useOrbitalStore((s) => s.nodePlaneOpacity)
  const sectionPosition = useOrbitalStore((s) => s.sectionPosition)
  const sectionAxis = useOrbitalStore((s) => s.sectionAxis)
  const anomalyQueue = useOrbitalStore((s) => s.anomalyQueue)
  const notes = useOrbitalStore((s) => s.notes)
  const setCurrentScreenshotDataUrl = useOrbitalStore((s) => s.setCurrentScreenshotDataUrl)
  const setScreenshotModalOpen = useOrbitalStore((s) => s.setScreenshotModalOpen)

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [previewFilterState, setPreviewFilterState] = useState('')
  const [previewAnomalyNote, setPreviewAnomalyNote] = useState('')

  function handleTakeScreenshot() {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')

    const filterState = JSON.stringify({
      moleculeId: currentMoleculeId,
      orbitalId: currentOrbitalId,
      showNodePlanes,
      showSection,
      isosurfaceThreshold,
      nodePlaneOpacity,
      sectionPosition,
      sectionAxis,
    })

    const pendingAnomalies = anomalyQueue.filter(
      (a) => a.orbitalId === currentOrbitalId && a.status === 'pending'
    )
    const anomalyNote = pendingAnomalies
      .map((a) => `[${a.type}] ${a.description}`)
      .join('\n')

    addScreenshot({ dataUrl, filterState, anomalyNote, orbitalId: currentOrbitalId })

    setPreviewDataUrl(dataUrl)
    setPreviewFilterState(filterState)
    setPreviewAnomalyNote(anomalyNote)
    setCurrentScreenshotDataUrl(dataUrl)
    setScreenshotModalOpen(true)
  }

  function handleDownloadPreview() {
    if (!previewDataUrl) return
    const link = document.createElement('a')
    link.download = `orbital-${currentOrbitalId}-${Date.now()}.png`
    link.href = previewDataUrl
    link.click()
  }

  function handleClosePreview() {
    setPreviewDataUrl(null)
    setPreviewFilterState('')
    setPreviewAnomalyNote('')
    setScreenshotModalOpen(false)
    setCurrentScreenshotDataUrl('')
  }

  function handleGenerateReport() {
    const molecule = getMolecule(currentMoleculeId)
    const title = `${molecule?.formula || currentMoleculeId} 分子轨道报告`
    const now = formatDate(Date.now())

    const screenshotsHtml = screenshots
      .slice()
      .reverse()
      .map((s, i) => {
        const orb = getOrbital(currentMoleculeId, s.orbitalId)
        return `
        <div style="margin-bottom:24px;page-break-inside:avoid;">
          <h3 style="font-size:14px;margin:0 0 8px;">截图 ${i + 1} - ${orb?.label || s.orbitalId}</h3>
          <p style="font-size:11px;color:#888;margin:0 0 4px;">${formatDate(s.timestamp)}</p>
          <img src="${s.dataUrl}" style="max-width:100%;border:1px solid #333;border-radius:6px;" />
          <pre style="font-size:11px;color:#aaa;margin:8px 0 0;padding:8px;background:#1a1a2e;border-radius:4px;white-space:pre-wrap;">${s.filterState}</pre>
          ${s.anomalyNote ? `<p style="font-size:11px;color:#ff9f1c;margin:8px 0 0;">异常备注: ${s.anomalyNote}</p>` : ''}
        </div>`
      })
      .join('')

    const notesHtml = notes
      .slice()
      .reverse()
      .map((n) => {
        const orb = getOrbital(currentMoleculeId, n.orbitalId)
        return `
        <div style="margin-bottom:8px;padding:8px;background:#1a1a2e;border-radius:4px;">
          <span style="font-size:11px;color:#00ffd5;">${orb?.label || n.orbitalId}</span>
          <span style="font-size:11px;color:#888;margin-left:8px;">${formatDate(n.timestamp)}</span>
          ${n.anomalyTag ? `<span style="font-size:10px;color:#ff9f1c;margin-left:8px;">[${n.anomalyTag}]</span>` : ''}
          <p style="font-size:12px;color:#ddd;margin:4px 0 0;">${n.content}</p>
        </div>`
      })
      .join('')

    const anomaliesHtml = anomalyQueue
      .map((a) => {
        const orb = getOrbital(currentMoleculeId, a.orbitalId)
        return `
        <div style="margin-bottom:8px;padding:8px;background:#1a1a2e;border-radius:4px;border-left:3px solid ${a.status === 'pending' ? '#eab308' : a.status === 'resolved' ? '#22c55e' : '#6b7280'};">
          <span style="font-size:11px;color:#00ffd5;">${orb?.label || a.orbitalId}</span>
          <span style="font-size:10px;color:#888;margin-left:8px;">[${a.type}]</span>
          <span style="font-size:10px;color:#888;margin-left:8px;">${a.status}</span>
          <p style="font-size:12px;color:#ddd;margin:4px 0 0;">${a.description}</p>
          <span style="font-size:10px;color:#888;">${formatDate(a.timestamp)}</span>
        </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0d0d1a; color: #e0e0e0; margin: 0; padding: 24px; }
  h1 { font-size: 18px; color: #00ffd5; border-bottom: 1px solid #2a2a4a; padding-bottom: 8px; }
  h2 { font-size: 15px; color: #00ffd5; margin-top: 32px; }
</style>
</head>
<body>
<h1>${title}</h1>
<p style="font-size:12px;color:#888;">生成时间: ${now}</p>
<h2>截图时间线</h2>
${screenshotsHtml || '<p style="font-size:12px;color:#666;">暂无截图</p>'}
<h2>备注记录</h2>
${notesHtml || '<p style="font-size:12px;color:#666;">暂无备注</p>'}
<h2>异常记录</h2>
${anomaliesHtml || '<p style="font-size:12px;color:#666;">暂无异常</p>'}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `report-${currentMoleculeId}-${Date.now()}.html`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-lab-muted uppercase tracking-wider">
          截图与报告
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGenerateReport}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-lab-glow/10 text-lab-glow border border-lab-glow/30 hover:bg-lab-glow/20 transition-all cursor-pointer"
          >
            <FileText size={11} />
            生成报告
          </button>
          <button
            type="button"
            onClick={handleTakeScreenshot}
            className="p-1.5 rounded text-lab-muted hover:text-lab-glow hover:bg-lab-glow/10 transition-all cursor-pointer"
            title="截图"
          >
            <Camera size={14} />
          </button>
        </div>
      </div>

      <div className="h-px bg-lab-border" />

      {previewDataUrl && (
        <div className="p-2 rounded bg-lab-surface/80 border border-lab-glow/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-lab-glow">截图预览</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDownloadPreview}
                className="p-1 rounded text-lab-muted hover:text-lab-glow hover:bg-lab-glow/10 transition-all cursor-pointer"
              >
                <Download size={12} />
              </button>
              <button
                type="button"
                onClick={handleClosePreview}
                className="p-1 rounded text-lab-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <img
            src={previewDataUrl}
            alt="截图预览"
            className="w-full rounded border border-lab-border mb-2"
          />

          <div className="text-[10px] font-mono text-lab-muted space-y-0.5">
            {(() => {
              try {
                const state = JSON.parse(previewFilterState)
                const mol = getMolecule(state.moleculeId)
                const orb = mol?.orbitals.find((o) => o.id === state.orbitalId)
                return (
                  <>
                    <div>
                      <span className="text-lab-text/70">分子:</span>{' '}
                      <span className="text-lab-text">{mol?.formula || state.moleculeId}</span>
                    </div>
                    <div>
                      <span className="text-lab-text/70">轨道:</span>{' '}
                      <span className="text-lab-text">{orb?.label || state.orbitalId}</span>
                    </div>
                    <div>
                      <span className="text-lab-text/70">节点面:</span>{' '}
                      <span className="text-lab-text">{state.showNodePlanes ? '开' : '关'}</span>
                      {state.showNodePlanes && (
                        <span className="text-lab-muted ml-1">
                          ({state.nodePlaneOpacity.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-lab-text/70">截面:</span>{' '}
                      <span className="text-lab-text">{state.showSection ? '开' : '关'}</span>
                      {state.showSection && (
                        <span className="text-lab-muted ml-1">
                          ({state.sectionAxis}={state.sectionPosition.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-lab-text/70">等值面:</span>{' '}
                      <span className="text-lab-text">{state.isosurfaceThreshold.toFixed(2)}</span>
                    </div>
                  </>
                )
              } catch {
                return null
              }
            })()}
          </div>

          {previewAnomalyNote && (
            <div className="mt-1.5 p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-mono text-amber-400">
                {previewAnomalyNote}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {screenshots.length === 0 ? (
          <div className="text-[11px] text-lab-muted/50 text-center py-4 font-mono">
            暂无截图
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {screenshots.map((s) => {
              const orb = getOrbital(currentMoleculeId, s.orbitalId)
              return (
                <div
                  key={s.id}
                  className="group relative aspect-video rounded overflow-hidden border border-lab-border hover:border-lab-glow/30 transition-all cursor-pointer"
                  onClick={() => {
                    setPreviewDataUrl(s.dataUrl)
                    setPreviewFilterState(s.filterState)
                    setPreviewAnomalyNote(s.anomalyNote)
                    setCurrentScreenshotDataUrl(s.dataUrl)
                    setScreenshotModalOpen(true)
                  }}
                >
                  <img
                    src={s.dataUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <div className="text-[8px] font-mono text-lab-text/80 truncate">
                      {orb?.label || s.orbitalId}
                    </div>
                    <div className="text-[7px] font-mono text-lab-muted/60">
                      {formatTime(s.timestamp)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
