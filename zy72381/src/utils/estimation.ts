import type { EstimationResult, TemperatureRecord } from '@/types'

const STEEL_EXPANSION_COEFFICIENT = 0.000012
const DEFAULT_BRIDGE_LENGTH = 100000

export function calculateExpansion(
  tempDiff: number,
  length: number = DEFAULT_BRIDGE_LENGTH,
  alpha: number = STEEL_EXPANSION_COEFFICIENT
): number {
  return tempDiff * length * alpha
}

export function performEstimation(
  record: { tempDiff: number; directionMark?: string; normalizedDirection?: 'positive' | 'negative' } & Partial<TemperatureRecord>,
  manualDirection?: 'positive' | 'negative'
): EstimationResult {
  const expansionValue = calculateExpansion(record.tempDiff)
  
  let direction: 'positive' | 'negative' = 'positive'
  let confidence = 0.95

  if (manualDirection) {
    direction = manualDirection
    confidence = 0.9
  } else if (record.normalizedDirection) {
    direction = record.normalizedDirection
  } else if (record.directionMark === '负方向') {
    direction = 'negative'
  } else if (record.directionMark === '正方向') {
    direction = 'positive'
  } else if (record.directionMark === '向左') {
    confidence = 0.5
    direction = 'negative'
  }

  const signedValue = direction === 'negative' ? -expansionValue : expansionValue
  const formula = `伸缩量 = 温差(${record.tempDiff}K) × 桥长(${DEFAULT_BRIDGE_LENGTH}mm) × 线膨胀系数(${STEEL_EXPANSION_COEFFICIENT}/K) × 方向(${direction === 'positive' ? '+' : '-'})`

  return {
    recordId: record.id,
    expansionValue: Number(signedValue.toFixed(2)),
    direction,
    confidence,
    calculationFormula: formula,
    timestamp: new Date().toISOString()
  }
}

export function formatEstimationValue(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)} mm`
}
