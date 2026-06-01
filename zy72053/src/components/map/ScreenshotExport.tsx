import { useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useStats } from '@/hooks/useDerivedData'
import {
  SEVERITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from '@/types'
import html2canvas from 'html2canvas'
import { Camera, X, Download } from 'lucide-react'

export default function ScreenshotExport() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const filters = useStore((s) => s.filters)
  const stats = useStats()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  async function handleCapture() {
    setBusy(true)
    try {
      const mapEl = document.getElementById('map-container')
      if (!mapEl) return

      const canvas = await html2canvas(mapEl, {
        backgroundColor: '#0a0a0f',
        scale: 2,
      })

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.save()

        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, canvas.width, 340)

        ctx.font = 'bold 22px sans-serif'
        ctx.fillStyle = '#22d3ee'
        ctx.fillText('筛选条件', 24, 36)

        ctx.font = '16px sans-serif'
        ctx.fillStyle = '#d1d5db'
        const severityText = filters.severity.length > 0
          ? filters.severity.map((s) => SEVERITY_LABELS[s]).join(', ')
          : '全部'
        ctx.fillText(`腐蚀等级: ${severityText}`, 24, 64)

        const sourceText = filters.sources.length > 0
          ? filters.sources.map((s) => SOURCE_LABELS[s]).join(', ')
          : '全部'
        ctx.fillText(`数据来源: ${sourceText}`, 24, 88)

        ctx.fillText(`日期范围: ${filters.dateRange[0]} ~ ${filters.dateRange[1]}`, 24, 112)

        const statusText = filters.status.length > 0
          ? filters.status.map((s) => STATUS_LABELS[s]).join(', ')
          : '全部'
        ctx.fillText(`状态: ${statusText}`, 24, 136)

        ctx.font = '13px sans-serif'
        ctx.fillStyle = '#9ca3af'
        ctx.fillText(`导出时间: ${new Date().toLocaleString('zh-CN')}`, 24, 168)

        ctx.font = 'bold 22px sans-serif'
        ctx.fillStyle = '#22d3ee'
        ctx.textAlign = 'right'
        ctx.fillText('统计概览', canvas.width - 24, 36)

        ctx.font = '16px sans-serif'
        ctx.fillStyle = '#d1d5db'
        ctx.fillText(`总点位: ${stats.total}`, canvas.width - 24, 64)
        ctx.fillText(`异常: ${stats.anomaly}`, canvas.width - 24, 88)
        ctx.fillText(`例外: ${stats.exception}`, canvas.width - 24, 112)
        ctx.fillText(`冲突: ${stats.conflict}`, canvas.width - 24, 136)

        ctx.restore()
      }

      canvasRef.current = canvas
      setPreviewUrl(canvas.toDataURL('image/png'))
    } finally {
      setBusy(false)
    }
  }

  function handleDownload() {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `pipeline-map-${Date.now()}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  return (
    <>
      <button
        onClick={handleCapture}
        disabled={busy}
        className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border border-cyan-500/40 bg-black/60 px-4 py-2 text-sm text-cyan-400 backdrop-blur-sm transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
      >
        <Camera size={16} />
        {busy ? '导出中...' : '截图导出'}
      </button>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-[90vw] max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-gray-900">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h3 className="text-sm font-semibold text-cyan-400">截图预览</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto p-4">
              <img
                src={previewUrl}
                alt="screenshot preview"
                className="mx-auto max-h-[60vh] rounded border border-white/5"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-3">
              <button
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-200"
              >
                关闭
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                <Download size={14} />
                下载
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
