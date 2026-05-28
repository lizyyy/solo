import { YieldCurvePoint, PortfolioPosition, ScenarioAlert, TENOR_YEARS, AlertType } from '@/types'

export function detectInversion(curve: YieldCurvePoint[]): ScenarioAlert | null {
  const sorted = [...curve].sort((a, b) => TENOR_YEARS[a.tenor] - TENOR_YEARS[b.tenor])

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i].rate > sorted[j].rate) {
        const shortLabel = sorted[i].tenor
        const longLabel = sorted[j].tenor
        return {
          id: `inv-${Date.now()}`,
          type: 'inversion',
          timestamp: Date.now(),
          details: `${shortLabel}(${sorted[i].rate.toFixed(2)}%) > ${longLabel}(${sorted[j].rate.toFixed(2)}%)，收益率曲线倒挂`,
          severity: 'error',
          suggestion: `考虑做多${shortLabel}、做空${longLabel}，或降低组合久期以规避经济衰退风险`,
        }
      }
    }
  }
  return null
}

export function detectDurationMismatch(actual: number, target: number, threshold: number = 1.0): ScenarioAlert | null {
  const diff = Math.abs(actual - target)
  if (diff > threshold) {
    const direction = actual > target ? '偏长' : '偏短'
    return {
      id: `dur-${Date.now()}`,
      type: 'duration_mismatch',
      timestamp: Date.now(),
      details: `组合久期${actual.toFixed(2)}年，目标${target.toFixed(2)}年，${direction}${diff.toFixed(2)}年`,
      severity: diff > 2 ? 'error' : 'warning',
      suggestion: actual > target
        ? `减少长久期债券权重，增加短久期债券以缩短组合久期`
        : `增加长久期债券权重，减少短久期债券以拉长组合久期`,
    }
  }
  return null
}

export function detectWeightOverflow(positions: PortfolioPosition[]): ScenarioAlert | null {
  const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0)
  if (totalWeight > 100) {
    const overBy = totalWeight - 100
    const overPositions = positions.filter(p => p.weight > 0).map(p => `${p.bondId}: ${p.weight}%`)
    return {
      id: `wgt-${Date.now()}`,
      type: 'weight_overflow',
      timestamp: Date.now(),
      details: `总权重${totalWeight.toFixed(1)}%，超标${overBy.toFixed(1)}%。当前配置：${overPositions.join('、')}`,
      severity: 'error',
      suggestion: `将总权重降至100%以内，优先降低对久期偏差贡献最大的债券权重`,
    }
  }
  return null
}

export function runAllChecks(
  curve: YieldCurvePoint[],
  positions: PortfolioPosition[],
  actualDuration: number,
  targetDuration: number
): ScenarioAlert[] {
  const alerts: ScenarioAlert[] = []
  const inv = detectInversion(curve)
  if (inv) alerts.push(inv)
  const dur = detectDurationMismatch(actualDuration, targetDuration)
  if (dur) alerts.push(dur)
  const wgt = detectWeightOverflow(positions)
  if (wgt) alerts.push(wgt)
  return alerts
}

export const ALERT_CONFIG: Record<AlertType, { label: string; color: string; bgColor: string; icon: string }> = {
  inversion: { label: '曲线倒挂', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', icon: '⚠' },
  duration_mismatch: { label: '久期错配', color: '#f97316', bgColor: 'rgba(249,115,22,0.15)', icon: '◈' },
  weight_overflow: { label: '权重超标', color: '#eab308', bgColor: 'rgba(234,179,8,0.15)', icon: '⊘' },
}
