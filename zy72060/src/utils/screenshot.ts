import { useStore } from '@/store/useStore'
import { VIEW_PRESETS, ViewPreset } from '@/types'

function addWatermark(canvas: HTMLCanvasElement, filterContext: string): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const watermarkCanvas = document.createElement('canvas')
  watermarkCanvas.width = canvas.width
  watermarkCanvas.height = canvas.height
  const wCtx = watermarkCanvas.getContext('2d')!
  wCtx.drawImage(canvas, 0, 0)

  const timestamp = new Date().toLocaleString('zh-CN')
  const currentPlan = useStore.getState().plans.find(
    (p) => p.id === useStore.getState().currentPlanId
  )
  const planName = currentPlan?.name || '未命名方案'

  wCtx.fillStyle = 'rgba(0,0,0,0.6)'
  const padding = 16
  const lineHeight = 22
  const lines = [
    `方案: ${planName}`,
    `筛选: ${filterContext}`,
    `时间: ${timestamp}`,
  ]
  const maxWidth = Math.max(...lines.map((l) => wCtx.measureText(l).width)) + padding * 2
  const boxHeight = lines.length * lineHeight + padding * 2

  wCtx.fillRect(10, 10, maxWidth, boxHeight)

  wCtx.fillStyle = '#00E5A0'
  wCtx.font = '14px "Noto Sans SC", sans-serif'
  lines.forEach((line, i) => {
    wCtx.fillText(line, 10 + padding, 10 + padding + (i + 1) * lineHeight - 4)
  })

  return watermarkCanvas
}

export async function captureScene(
  glCanvas: HTMLCanvasElement,
  filterContext: string
): Promise<string> {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = glCanvas.width
  tempCanvas.height = glCanvas.height
  const ctx = tempCanvas.getContext('2d')!
  ctx.drawImage(glCanvas, 0, 0)

  const watermarked = addWatermark(tempCanvas, filterContext)
  return watermarked.toDataURL('image/png')
}

export function downloadScreenshot(dataUrl: string, filename?: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename || `岸桥作业立方_${new Date().toISOString().slice(0, 10)}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function getFilterLabel(): string {
  const { filterStatus, points } = useStore.getState()
  if (filterStatus === 'all') return `全部 (${points.length})`
  const count = points.filter((p) => p.status === filterStatus).length
  const labels: Record<string, string> = {
    normal: '正常',
    anomaly: '异常',
    conflict: '冲突',
    pending: '待处理',
  }
  return `${labels[filterStatus] || filterStatus} (${count})`
}

export function getViewPresetLabel(preset: ViewPreset): string {
  const labels: Record<ViewPreset, string> = {
    front: '正面',
    side: '侧面',
    top: '俯视',
    free: '自由',
  }
  return labels[preset]
}

export { VIEW_PRESETS }
