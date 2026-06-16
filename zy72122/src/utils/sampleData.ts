import type { ExperimentRecord, AuditEntry } from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import { generateId, nowISO } from './helpers'

export function generateSampleData(): {
  records: ExperimentRecord[]
  audit: AuditEntry[]
} {
  const now = nowISO()

  const record1: ExperimentRecord = {
    id: generateId(),
    timestamp: '2026-05-20T10:00:00',
    springStiffness: 25.5,
    stiffnessUnit: 'N/mm',
    displacement: 15.2,
    displacementUnit: 'mm',
    force: 15.2 * 25.5,
    forceUnit: 'N',
    direction: '+',
    source: { type: 'photo', reference: 'IMG_20260520_001' },
    processedAt: '2026-05-20T10:05:00',
    status: 'passed',
  }

  const record2: ExperimentRecord = {
    id: generateId(),
    timestamp: '2026-05-20T10:01:00',
    springStiffness: 25.5,
    stiffnessUnit: 'N/mm',
    displacement: 52.8,
    displacementUnit: 'mm',
    force: 52.8 * 25.5,
    forceUnit: 'N',
    direction: '+',
    source: { type: 'manual', reference: '实验记录本第12页' },
    processedAt: '2026-05-20T10:06:00',
    status: 'needs_review',
    reviewNote: undefined,
  }

  const record3: ExperimentRecord = {
    id: generateId(),
    timestamp: '2026-05-15T14:30:00',
    springStiffness: 2.55,
    stiffnessUnit: 'N/cm',
    displacement: 1.52,
    displacementUnit: 'cm',
    force: 38.76,
    forceUnit: 'N',
    direction: '+',
    source: { type: 'legacy', reference: '旧报告R-2026-003附照片IMG_20260515_007' },
    processedAt: '2026-05-20T11:00:00',
    status: 'legacy_amended',
    amendedFrom: '旧口径（cm/N/cm），已转换为mm/N/mm',
    originalValues: {
      displacement: 1.52,
      displacementUnit: 'cm',
      springStiffness: 2.55,
      stiffnessUnit: 'N/cm',
    },
  }

  const audit: AuditEntry[] = [
    {
      id: generateId(),
      recordId: record1.id,
      action: 'created',
      timestamp: '2026-05-20T10:05:00',
      operator: '项目助理小宋',
      details: `从现场照片 ${record1.source.reference} 录入，力=${record1.force.toFixed(1)}N，位移=${record1.displacement}mm`,
      newStatus: 'passed',
    },
    {
      id: generateId(),
      recordId: record1.id,
      action: 'validated',
      timestamp: '2026-05-20T10:05:01',
      operator: '系统',
      details: '所有校验通过：方向符号正确、单位一致、时间间隔正常、无采样缺口、数值在安全阈值内',
      newStatus: 'passed',
    },
    {
      id: generateId(),
      recordId: record2.id,
      action: 'created',
      timestamp: '2026-05-20T10:06:00',
      operator: '项目助理小宋',
      details: `从${record2.source.reference}录入，力=${record2.force.toFixed(1)}N，位移=${record2.displacement}mm`,
      newStatus: 'needs_review',
    },
    {
      id: generateId(),
      recordId: record2.id,
      action: 'validated',
      timestamp: '2026-05-20T10:06:01',
      operator: '系统',
      details: `安全阈值校验未通过：力 ${record2.force.toFixed(1)}N 超过安全上限 ${DEFAULT_CONFIG.forceThresholdMax}N，需人工确认`,
      newStatus: 'needs_review',
    },
    {
      id: generateId(),
      recordId: record3.id,
      action: 'amended',
      timestamp: '2026-05-20T11:00:00',
      operator: '项目助理小宋',
      details: `从旧报告补录（来源：${record3.source.reference}），原始单位为cm/N/cm，已转换为mm/N/N/mm`,
      previousStatus: 'legacy_amended',
      newStatus: 'legacy_amended',
    },
    {
      id: generateId(),
      recordId: record3.id,
      action: 'validated',
      timestamp: '2026-05-20T11:00:01',
      operator: '系统',
      details: '单位与期望不一致（cm vs mm），但已标注为旧口径补录；数值在安全阈值内',
      newStatus: 'legacy_amended',
    },
  ]

  return { records: [record1, record2, record3], audit }
}
