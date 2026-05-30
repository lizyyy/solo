import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SPL_MIN = 45
export const SPL_MAX = 105

const HEATMAP_STOPS: { t: number; color: [number, number, number] }[] = [
  { t: 0.0, color: [10, 30, 80] },
  { t: 0.2, color: [20, 80, 160] },
  { t: 0.4, color: [40, 180, 180] },
  { t: 0.6, color: [120, 220, 60] },
  { t: 0.8, color: [255, 200, 40] },
  { t: 1.0, color: [230, 40, 40] },
]

export function splToColor(spl: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (spl - SPL_MIN) / (SPL_MAX - SPL_MIN)))
  
  for (let i = 0; i < HEATMAP_STOPS.length - 1; i++) {
    const curr = HEATMAP_STOPS[i]
    const next = HEATMAP_STOPS[i + 1]
    if (t >= curr.t && t <= next.t) {
      const range = next.t - curr.t
      const localT = (t - curr.t) / range
      return [
        curr.color[0] + (next.color[0] - curr.color[0]) * localT,
        curr.color[1] + (next.color[1] - curr.color[1]) * localT,
        curr.color[2] + (next.color[2] - curr.color[2]) * localT,
      ]
    }
  }
  return HEATMAP_STOPS[HEATMAP_STOPS.length - 1].color
}

export function splToColorHex(spl: number): string {
  const [r, g, b] = splToColor(spl)
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export const ANOMALY_COLORS: Record<string, string> = {
  frequency_mismatch: '#9333ea',
  seat_occlusion: '#f97316',
  delay_inversion: '#dc2626',
}

export const ANOMALY_LABELS: Record<string, string> = {
  frequency_mismatch: '频段错配',
  seat_occlusion: '座位遮挡',
  delay_inversion: '延时反向',
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
