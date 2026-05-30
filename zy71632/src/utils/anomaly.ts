import type { AnomalyType, AnomalyEntry } from '@/types'
import { ANOMALY_MESSAGES } from '@/types'

export function createAnomalyEntry(
  type: AnomalyType,
  pathId: string,
  stepIndex: number
): AnomalyEntry {
  const preset = ANOMALY_MESSAGES[type]
  return {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    pathId,
    stepIndex,
    message: preset.message,
    handlingNote: preset.handlingNote,
    timestamp: Date.now(),
  }
}

export function getAnomalySeverity(type: AnomalyType): 'info' | 'warning' | 'error' {
  switch (type) {
    case 'ARROW_REVERSED':
      return 'info'
    case 'PATH_BOUNDARY':
      return 'warning'
    case 'STEP_TOO_LARGE':
      return 'warning'
    default:
      return 'info'
  }
}

export function getAnomalyIcon(type: AnomalyType): string {
  switch (type) {
    case 'ARROW_REVERSED':
      return '↔'
    case 'PATH_BOUNDARY':
      return '⊘'
    case 'STEP_TOO_LARGE':
      return '⚡'
    default:
      return '⚠'
  }
}
