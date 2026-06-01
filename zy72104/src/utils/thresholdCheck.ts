import type { CalcResult, ThresholdAlert, Suggestion, AlertLevel } from '@/types'

const THRESHOLDS = {
  headDeviation: { notice: 5, warning: 10, danger: 20 },
  lossRatio: { notice: 15, warning: 25, danger: 40 },
  pumpEfficiency: { notice: 75, warning: 60, danger: 40 },
  reynoldsType: 2300,
}

function getAlertLevel(value: number, thresholds: { notice: number; warning: number; danger: number }, inverted = false): AlertLevel {
  if (inverted) {
    if (value < thresholds.danger) return 'danger'
    if (value < thresholds.warning) return 'warning'
    if (value < thresholds.notice) return 'notice'
    return 'info'
  }
  if (value > thresholds.danger) return 'danger'
  if (value > thresholds.warning) return 'warning'
  if (value > thresholds.notice) return 'notice'
  return 'info'
}

export function checkThresholds(result: CalcResult): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = []
  let counter = 0

  const headLevel = getAlertLevel(Math.abs(result.headDeviation), THRESHOLDS.headDeviation)
  if (headLevel !== 'info') {
    const absDev = Math.abs(result.headDeviation)
    const th = THRESHOLDS.headDeviation
    const threshold = absDev > th.danger ? th.danger : absDev > th.warning ? th.warning : th.notice
    alerts.push({
      id: `alert-head-${counter++}`,
      alertType: '扬程偏差',
      level: headLevel,
      value: result.headDeviation,
      threshold,
      unit: '%',
      message: `扬程偏差 ${result.headDeviation.toFixed(1)}%，${headLevel === 'danger' ? '超出安全范围' : headLevel === 'warning' ? '需要关注' : '略有偏差'}`,
      suggestion: headLevel === 'danger'
        ? '立即停机检查：扬程严重偏离额定值，可能是叶轮磨损、密封泄漏或管路堵塞'
        : headLevel === 'warning'
        ? '请安排检查：扬程偏差较大，建议检查泵体状态和管路通畅性'
        : '关注运行趋势：扬程略有偏差，持续观察是否扩大',
    })
  }

  const lossLevel = getAlertLevel(result.lossRatio, THRESHOLDS.lossRatio)
  if (lossLevel !== 'info') {
    const th = THRESHOLDS.lossRatio
    const threshold = result.lossRatio > th.danger ? th.danger : result.lossRatio > th.warning ? th.warning : th.notice
    alerts.push({
      id: `alert-loss-${counter++}`,
      alertType: '管损占比',
      level: lossLevel,
      value: result.lossRatio,
      threshold,
      unit: '%',
      message: `管损占总扬程 ${result.lossRatio.toFixed(1)}%，${lossLevel === 'danger' ? '管路损耗过大' : lossLevel === 'warning' ? '管损偏高' : '管损略高'}`,
      suggestion: lossLevel === 'danger'
        ? '紧急排查管路：管损占比过高，检查阀门开度、滤网堵塞、管径是否偏小'
        : lossLevel === 'warning'
        ? '请检查管路：管损偏高，建议清洗滤网、检查阀门状态'
        : '关注管损趋势：管损略高，持续监测是否有上升趋势',
    })
  }

  const effLevel = getAlertLevel(result.pumpEfficiency, THRESHOLDS.pumpEfficiency, true)
  if (effLevel !== 'info') {
    const th = THRESHOLDS.pumpEfficiency
    const threshold = result.pumpEfficiency < th.danger ? th.danger : result.pumpEfficiency < th.warning ? th.warning : th.notice
    alerts.push({
      id: `alert-eff-${counter++}`,
      alertType: '泵效率',
      level: effLevel,
      value: result.pumpEfficiency,
      threshold,
      unit: '%',
      message: `泵效率 ${result.pumpEfficiency.toFixed(1)}%，${effLevel === 'danger' ? '严重低于正常值' : effLevel === 'warning' ? '明显偏低' : '略有下降'}`,
      suggestion: effLevel === 'danger'
        ? '建议大修或更换：泵效率严重不足，叶轮可能已严重磨损'
        : effLevel === 'warning'
        ? '建议安排检修：泵效率偏低，检查叶轮间隙和密封件'
        : '关注效率趋势：泵效率略有下降，建议下次巡检重点检查',
    })
  }

  if (result.reynoldsNumber < THRESHOLDS.reynoldsType) {
    alerts.push({
      id: `alert-re-${counter++}`,
      alertType: '流动状态',
      level: 'notice',
      value: result.reynoldsNumber,
      threshold: THRESHOLDS.reynoldsType,
      unit: '',
      message: `雷诺数 ${result.reynoldsNumber.toFixed(0)}，流动为层流状态，Darcy-Weisbach公式适用但需注意精度`,
      suggestion: '流量较低时管损计算精度有限，建议结合实际测量验证',
    })
  }

  return alerts
}

export function generateSuggestions(result: CalcResult, alerts: ThresholdAlert[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  let counter = 0

  if (result.headDeviation < -10) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '扬程不足',
      action: '检查泵入口滤网是否堵塞，清洗或更换滤网',
      explanation: `扬程偏差 ${result.headDeviation.toFixed(1)}%，低于额定值较多，入口堵塞是常见原因`,
      priority: 'danger',
    })
  }
  if (result.headDeviation > 10) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '扬程偏高',
      action: '检查出口阀门开度，确认管路是否有异常堵塞',
      explanation: `扬程偏差 +${result.headDeviation.toFixed(1)}%，高于额定值，可能是出口阻力过大`,
      priority: 'warning',
    })
  }
  if (result.lossRatio > 25) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '管损过大',
      action: '逐步检查管路各段：阀门全开确认、滤网清洗、管径校核',
      explanation: `管损占比 ${result.lossRatio.toFixed(1)}%，沿程损失 ${result.frictionLoss.toFixed(2)}m，局部损失 ${result.localLoss.toFixed(2)}m`,
      priority: 'warning',
    })
  }
  if (result.pumpEfficiency < 60) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '效率低下',
      action: '安排泵体检修：检查叶轮磨损、密封环间隙、轴承状态',
      explanation: `泵效率 ${result.pumpEfficiency.toFixed(1)}%，低于 60% 属于异常`,
      priority: 'danger',
    })
  }
  if (result.frictionFactor > 0.03) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '摩擦系数偏高',
      action: '检查管道内壁状态，评估是否需要清洗或更换管段',
      explanation: `摩擦系数 ${result.frictionFactor.toFixed(4)}，高于常规范围（0.01~0.03），管道可能结垢或锈蚀`,
      priority: 'notice',
    })
  }

  if (suggestions.length === 0 && alerts.length === 0) {
    suggestions.push({
      id: `sug-${counter++}`,
      category: '正常运行',
      action: '保持当前巡检频率，继续监测运行参数',
      explanation: '各项指标均在正常范围内，无需特殊处理',
      priority: 'info',
    })
  }

  return suggestions
}
