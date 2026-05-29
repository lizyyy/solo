import {
  Material,
  WeightConfig,
  ScoreBreakdown,
  FrequencyBand,
  FREQUENCY_BANDS,
  LOW_FREQ_BANDS,
  MID_FREQ_BANDS,
  HIGH_FREQ_BANDS,
  MaterialCombination,
  CombinationItem,
  ValidationIssue,
} from '@/types'
import { validateMaterial } from './validation'

function getWeightForBand(freq: FrequencyBand, config: WeightConfig): number {
  if (LOW_FREQ_BANDS.includes(freq)) return config.lowWeight / LOW_FREQ_BANDS.length
  if (MID_FREQ_BANDS.includes(freq)) return config.midWeight / MID_FREQ_BANDS.length
  return config.highWeight / HIGH_FREQ_BANDS.length
}

export function calculateScore(material: Material, weightConfig: WeightConfig): ScoreBreakdown {
  const issues = validateMaterial(material)
  const rawCoefficients = { ...material.coefficients }
  const weightApplied: Record<FrequencyBand, number> = {} as Record<FrequencyBand, number>
  const weightedValues: Record<FrequencyBand, number> = {} as Record<FrequencyBand, number>
  let totalScore = 0
  let totalWeight = 0

  FREQUENCY_BANDS.forEach((freq) => {
    const weight = getWeightForBand(freq, weightConfig)
    weightApplied[freq] = weight
    const val = rawCoefficients[freq]
    if (val !== null && val >= 0 && val <= 1) {
      weightedValues[freq] = val * weight
      totalScore += val * weight
      totalWeight += weight
    } else {
      weightedValues[freq] = 0
    }
  })

  if (totalWeight > 0) {
    totalScore = totalScore / totalWeight * (LOW_FREQ_BANDS.length + MID_FREQ_BANDS.length + HIGH_FREQ_BANDS.length) / FREQUENCY_BANDS.length
  }

  return {
    materialId: material.id,
    materialName: material.name,
    rawCoefficients,
    weightApplied,
    weightedValues,
    totalScore,
    issues,
  }
}

export function calculateCombinationScore(
  materials: Material[],
  items: CombinationItem[],
  weightConfig: WeightConfig,
): Pick<MaterialCombination, 'combinedCoefficients' | 'weightedScore'> {
  const combinedCoefficients = {} as Record<FrequencyBand, number>
  let totalRatio = 0

  items.forEach((item) => {
    totalRatio += item.areaRatio
  })

  FREQUENCY_BANDS.forEach((freq) => {
    let weightedSum = 0
    items.forEach((item) => {
      const mat = materials.find((m) => m.id === item.materialId)
      if (mat && mat.coefficients[freq] !== null) {
        const val = mat.coefficients[freq]!
        if (val >= 0 && val <= 1) {
          weightedSum += val * (item.areaRatio / totalRatio)
        }
      }
    })
    combinedCoefficients[freq] = Math.round(weightedSum * 1000) / 1000
  })

  let totalScore = 0
  let totalWeight = 0

  FREQUENCY_BANDS.forEach((freq) => {
    const weight = getWeightForBand(freq, weightConfig)
    const val = combinedCoefficients[freq]
    if (val >= 0 && val <= 1) {
      totalScore += val * weight
      totalWeight += weight
    }
  })

  if (totalWeight > 0) {
    totalScore = totalScore / totalWeight * (LOW_FREQ_BANDS.length + MID_FREQ_BANDS.length + HIGH_FREQ_BANDS.length) / FREQUENCY_BANDS.length
  }

  return {
    combinedCoefficients,
    weightedScore: Math.round(totalScore * 100) / 100,
  }
}

export function getScoreExplanation(breakdown: ScoreBreakdown): string[] {
  const lines: string[] = []
  lines.push(`【${breakdown.materialName} 评分推导】`)
  lines.push('')

  const errors = breakdown.issues.filter((i) => i.severity === 'error')
  const warnings = breakdown.issues.filter((i) => i.severity === 'warning')

  if (errors.length > 0) {
    lines.push('⚠ 数据异常：')
    errors.forEach((e) => lines.push(`  ❌ ${e.detail}`))
    lines.push('')
  }
  if (warnings.length > 0) {
    lines.push('⚠ 数据警告：')
    warnings.forEach((w) => lines.push(`  ⚡ ${w.detail}`))
    lines.push('')
  }

  lines.push('频段推导过程：')
  FREQUENCY_BANDS.forEach((freq) => {
    const raw = breakdown.rawCoefficients[freq]
    const weight = breakdown.weightApplied[freq]
    const weighted = breakdown.weightedValues[freq]
    const bandGroup = LOW_FREQ_BANDS.includes(freq) ? '低频' : MID_FREQ_BANDS.includes(freq) ? '中频' : '高频'
    if (raw === null) {
      lines.push(`  ${freq}(${bandGroup}): 数据缺失 → 权重${weight.toFixed(3)} → 加权值0(跳过)`)
    } else if (raw < 0 || raw > 1) {
      lines.push(`  ${freq}(${bandGroup}): ${raw}(越界!) → 权重${weight.toFixed(3)} → 加权值0(跳过)`)
    } else {
      lines.push(`  ${freq}(${bandGroup}): ${raw} × 权重${weight.toFixed(3)} = ${weighted.toFixed(4)}`)
    }
  })

  lines.push('')
  lines.push(`综合评分: ${breakdown.totalScore.toFixed(4)}`)

  return lines
}

export function checkBudgetOverrun(
  materials: Material[],
  issues: ValidationIssue[],
  budgetPerSqm: number,
): ValidationIssue[] {
  const overrunIssues: ValidationIssue[] = []
  materials.forEach((mat) => {
    if (mat.unitPrice > budgetPerSqm) {
      overrunIssues.push({
        materialId: mat.id,
        materialName: mat.name,
        type: 'budget_overrun',
        detail: `${mat.name} 单价 ¥${mat.unitPrice}/m² 超出预算 ¥${budgetPerSqm}/m²`,
        severity: 'warning',
      })
    }
  })
  return overrunIssues
}
