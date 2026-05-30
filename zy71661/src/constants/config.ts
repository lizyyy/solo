export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const
export const DEFAULT_PLAYBACK_SPEED = 1
export const SIMULATION_TIME_STEP = 0.01
export const MAX_SIMULATION_TIME = 10
export const SUPPLEMENT_COLOR = '#ff8c42'
export const ANOMALY_COLORS: Record<string, string> = {
  low: '#4ade80',
  medium: '#facc15',
  high: '#f97316',
  critical: '#ef4444',
}
export const EXPORT_FORMATS = ['png', 'svg', 'csv', 'xlsx', 'json'] as const
