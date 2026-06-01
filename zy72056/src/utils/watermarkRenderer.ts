import type { FilterState } from "@/data/types"
import { DEVICE_TYPE_LABELS } from "@/data/types"
import { FLOOR_LABELS } from "@/data/mockStation"

export function renderWatermark(
  canvas: HTMLCanvasElement,
  filter: FilterState,
  timestamp: string,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const lines: string[] = [
    `地铁站厅拥堵热力图 - 导出截图`,
    `时间: ${timestamp}`,
    `楼层: ${filter.floors.map(f => FLOOR_LABELS[f] || f).join(", ")}`,
    `设备类型: ${filter.types.map(t => DEVICE_TYPE_LABELS[t] || t).join(", ")}`,
    `质量状态: ${filter.qualityStatus.join(", ")}`,
    `时段: ${filter.timeHour}:00`,
  ]

  const padding = 16
  const lineHeight = 20
  const boxHeight = lines.length * lineHeight + padding * 2
  const boxWidth = 320

  const y = canvas.height - boxHeight - 12
  const x = 12

  ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
  ctx.roundRect(x, y, boxWidth, boxHeight, 6)
  ctx.fill()

  ctx.fillStyle = "#FFFFFF"
  ctx.font = "13px 'Noto Sans SC', sans-serif"
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 14 + i * lineHeight)
  })

  return canvas
}
