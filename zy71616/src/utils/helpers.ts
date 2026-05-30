export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6)
}

export function rollMultipleDice(count: number): number[] {
  return Array.from({ length: count }, () => rollDice())
}

export function computeExperimentalProbabilities(faceCounts: number[], totalRolls: number): number[] {
  if (totalRolls === 0) return Array(6).fill(0)
  return faceCounts.map(c => c / totalRolls)
}

export function checkNormalization(probabilities: number[], tolerance = 0.01): { isNormalized: boolean; sum: number } {
  const sum = probabilities.reduce((a, b) => a + b, 0)
  return { isNormalized: Math.abs(sum - 1) <= tolerance, sum }
}

export function computeStatistics(faceCounts: number[], totalRolls: number): { mean: number; variance: number } {
  if (totalRolls === 0) return { mean: 0, variance: 0 }
  const probs = computeExperimentalProbabilities(faceCounts, totalRolls)
  const mean = probs.reduce((sum, p, i) => sum + p * (i + 1), 0)
  const variance = probs.reduce((sum, p, i) => sum + p * Math.pow((i + 1) - mean, 2), 0)
  return { mean, variance }
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatProbability(p: number): string {
  return (p * 100).toFixed(1) + '%'
}

export function buildExportMetadata(dataScope: string) {
  return {
    exportTime: new Date().toISOString(),
    processingCaliber: '异常操作定义为：概率未归一(|sum-1|>0.01)、样本清零后统计未重置、已坍缩骰子重复测量>3次',
    dataScope,
    anomalyHandling: '异常数据保留原始值并标记，不自动修正，需人工确认',
    version: '1.0.0',
    caliberHistory: [
      { version: '1.0.0', date: '2026-05-30', change: '初始口径' },
    ],
  }
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
