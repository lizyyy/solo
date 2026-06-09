import type {
  TempRecord,
  InfluenceFactor,
  InfluenceFactorType,
} from '@shared/types.js'
import { newId } from '../db/lowdb.js'

const FACTOR_CONFIG: Record<
  InfluenceFactorType,
  { label: string; impact: InfluenceFactor['impact']; descriptionTemplate: string }
> = {
  vaccine_missing: {
    label: '疫苗接种日期缺失',
    impact: 'negative',
    descriptionTemplate: '检测到 {count} 项疫苗记录缺少接种日期，无法确认免疫状态有效性',
  },
  legacy_curve: {
    label: '体重曲线包含旧版数据',
    impact: 'neutral',
    descriptionTemplate: '检测到 {count} 个旧版体重测量点，可能影响趋势分析准确性',
  },
  boundary_sample: {
    label: '温度样本接近阈值边界',
    impact: 'neutral',
    descriptionTemplate:
      '{count}% 的温度测量点距离阈值 ±0.2℃ 范围内（共 {total} 点，边界点 {boundary} 个），存在误判风险需人工复核',
  },
  verbal_note: {
    label: '存在口头备注记录',
    impact: 'neutral',
    descriptionTemplate: '检测到 {count} 条口述来源的备注信息，书面信息完整性受限',
  },
}

export interface AnalyzeResult {
  factors: InfluenceFactor[]
  hasLegacyCurve: boolean
  isBoundarySample: boolean
}

function buildFactor(
  type: InfluenceFactorType,
  recordId: string,
  substitutions: Record<string, number>,
): InfluenceFactor {
  const cfg = FACTOR_CONFIG[type]
  let description = cfg.descriptionTemplate
  for (const [key, val] of Object.entries(substitutions)) {
    description = description.replace(`{${key}}`, String(val))
  }
  let label = cfg.label
  if (type === 'vaccine_missing' && substitutions.missingName) {
    // handled via description; keep label generic
  }
  return {
    id: newId('fac-'),
    type,
    label,
    impact: cfg.impact,
    description,
    affectedRecords: [recordId],
  }
}

export function analyzeFactors(record: Partial<TempRecord>): AnalyzeResult {
  const factors: InfluenceFactor[] = []
  let hasLegacyCurve = false
  let isBoundarySample = false

  const recordId = record.id || ''

  if (Array.isArray(record.vaccines)) {
    const missingVaccines = record.vaccines.filter((v) => v.date === null)
    if (missingVaccines.length > 0) {
      factors.push(
        buildFactor('vaccine_missing', recordId, {
          count: missingVaccines.length,
        }),
      )
    }
  }

  if (Array.isArray(record.weightCurve)) {
    const legacyPoints = record.weightCurve.filter((w) => w.version === 'legacy')
    if (legacyPoints.length > 0) {
      hasLegacyCurve = true
      factors.push(
        buildFactor('legacy_curve', recordId, {
          count: legacyPoints.length,
        }),
      )
    }
  }

  if (
    Array.isArray(record.tempCurve) &&
    record.tempThreshold &&
    record.tempCurve.length > 0
  ) {
    const { min, max } = record.tempThreshold
    const total = record.tempCurve.length
    let boundaryCount = 0
    for (const p of record.tempCurve) {
      const distToMin = Math.abs(p.value - min)
      const distToMax = Math.abs(p.value - max)
      if (distToMin < 0.2 || distToMax < 0.2) {
        boundaryCount++
      }
    }
    const ratio = boundaryCount / total
    const percent = Math.round(ratio * 100)
    if (ratio > 0.3) {
      isBoundarySample = true
      factors.push(
        buildFactor('boundary_sample', recordId, {
          count: percent,
          total,
          boundary: boundaryCount,
        }),
      )
    }
  }

  if (Array.isArray(record.notes)) {
    const verbalNotes = record.notes.filter((n) => n.source === 'verbal')
    if (verbalNotes.length > 0) {
      factors.push(
        buildFactor('verbal_note', recordId, {
          count: verbalNotes.length,
        }),
      )
    }
  }

  return { factors, hasLegacyCurve, isBoundarySample }
}
