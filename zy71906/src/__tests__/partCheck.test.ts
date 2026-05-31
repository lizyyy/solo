import { describe, it, expect } from 'vitest'
import {
  partCheck,
  generateReport,
  formatReportForManager,
  VersionTracker,
} from '../index.js'
import type { RehearsalRecord } from '../types.js'

function makeRecord(overrides: Partial<RehearsalRecord> & { id: string }): RehearsalRecord {
  return {
    studentName: '张三',
    measureRange: [1, 32],
    keySignature: 'C',
    partName: '小提琴I',
    version: 1,
    isLateAttachment: false,
    isManualCorrection: false,
    timestamp: '2026-05-30T10:00:00Z',
    ...overrides,
  }
}

describe('partCheck - 正常记录', () => {
  it('干净的连续记录应全部标记为 normal', () => {
    const records = [
      makeRecord({ id: 'R01', studentName: '张三', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', studentName: '李四', measureRange: [33, 64], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R03', studentName: '王五', measureRange: [1, 32], partName: '小提琴II', keySignature: 'C' }),
    ]

    const results = partCheck(records)
    expect(results.every((r) => r.status === 'normal')).toBe(true)
    expect(results.every((r) => r.anomalies.length === 0)).toBe(true)
  })
})

describe('partCheck - 小节错位', () => {
  it('同一分谱小节跳跃应检测为 measure_misalignment 并标为待确认', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I' }),
      makeRecord({ id: 'R02', measureRange: [40, 64], partName: '小提琴I' }),
    ]

    const results = partCheck(records)
    const r01 = results.find((r) => r.recordId === 'R01')!
    const r02 = results.find((r) => r.recordId === 'R02')!

    expect(r01.status).toBe('pending_confirmation')
    expect(r02.status).toBe('pending_confirmation')
    expect(r01.anomalies.some((a) => a.type === 'measure_misalignment')).toBe(true)
    expect(r01.reasons.length).toBeGreaterThan(0)
    expect(r01.nextSteps.length).toBeGreaterThan(0)
  })

  it('同一分谱小节重叠也应检测为 measure_misalignment', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 40], partName: '小提琴I' }),
      makeRecord({ id: 'R02', measureRange: [35, 64], partName: '小提琴I' }),
    ]

    const results = partCheck(records)
    const r01 = results.find((r) => r.recordId === 'R01')!
    expect(r01.anomalies.some((a) => a.type === 'measure_misalignment')).toBe(true)
    expect(r01.status).toBe('pending_confirmation')
  })
})

describe('partCheck - 转调未同步', () => {
  it('同小节不同分谱调号不一致应检测为 transposition_desync', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', measureRange: [1, 32], partName: '中提琴', keySignature: 'G' }),
    ]

    const results = partCheck(records)
    const r01 = results.find((r) => r.recordId === 'R01')!
    expect(r01.anomalies.some((a) => a.type === 'transposition_desync')).toBe(true)
    expect(r01.status).toBe('pending_confirmation')
    expect(r01.reasons.some((r) => r.includes('转调'))).toBe(true)
  })

  it('同分谱同调号不应误报', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', measureRange: [1, 32], partName: '小提琴II', keySignature: 'C' }),
    ]

    const results = partCheck(records)
    const desyncAnomalies = results.flatMap((r) =>
      r.anomalies.filter((a) => a.type === 'transposition_desync')
    )
    expect(desyncAnomalies.length).toBe(0)
  })
})

describe('partCheck - 重复学生统计', () => {
  it('同一学生在重叠小节出现在不同分谱应检测为 duplicate_student', () => {
    const records = [
      makeRecord({ id: 'R01', studentName: '张三', measureRange: [1, 32], partName: '小提琴I' }),
      makeRecord({ id: 'R02', studentName: '张三', measureRange: [20, 50], partName: '中提琴' }),
    ]

    const results = partCheck(records)
    const r01 = results.find((r) => r.recordId === 'R01')!
    expect(r01.anomalies.some((a) => a.type === 'duplicate_student')).toBe(true)
    expect(r01.status).toBe('pending_confirmation')
  })

  it('同一学生不同小节范围不重叠不应误报', () => {
    const records = [
      makeRecord({ id: 'R01', studentName: '张三', measureRange: [1, 32], partName: '小提琴I' }),
      makeRecord({ id: 'R02', studentName: '张三', measureRange: [33, 64], partName: '小提琴I' }),
    ]

    const results = partCheck(records)
    const dupAnomalies = results.flatMap((r) =>
      r.anomalies.filter((a) => a.type === 'duplicate_student')
    )
    expect(dupAnomalies.length).toBe(0)
  })
})

describe('partCheck - 晚到附件', () => {
  it('晚到附件应标记为待确认并给出原因', () => {
    const records = [
      makeRecord({
        id: 'R01',
        measureRange: [1, 32],
        partName: '小提琴I',
        isLateAttachment: true,
        timestamp: '2026-05-31T08:00:00Z',
      }),
    ]

    const results = partCheck(records)
    expect(results[0].status).toBe('pending_confirmation')
    expect(results[0].reasons.some((r) => r.includes('晚到附件'))).toBe(true)
    expect(results[0].nextSteps.some((s) => s.includes('对齐'))).toBe(true)
  })
})

describe('partCheck - 人工更正', () => {
  it('人工更正记录应标记为待确认并要求核实依据', () => {
    const records = [
      makeRecord({
        id: 'R01',
        measureRange: [1, 32],
        partName: '小提琴I',
        isManualCorrection: true,
        note: '原小节3调号由F更正为G',
      }),
    ]

    const results = partCheck(records)
    expect(results[0].status).toBe('pending_confirmation')
    expect(results[0].reasons.some((r) => r.includes('人工更正'))).toBe(true)
    expect(results[0].reasons.some((r) => r.includes('原小节3调号由F更正为G'))).toBe(true)
  })
})

describe('partCheck - 版本追踪', () => {
  it('补传旧版本应提醒变更，不静默覆盖前次判断', () => {
    const tracker = new VersionTracker()

    const firstBatch = [
      makeRecord({ id: 'R01', version: 2, measureRange: [1, 32], partName: '小提琴I' }),
    ]
    partCheck(firstBatch, { tracker })

    const secondBatch = [
      makeRecord({
        id: 'R02',
        version: 1,
        measureRange: [1, 30],
        partName: '小提琴I',
        previousVersionId: 'R01',
        note: '声部长备注：这是旧版本',
        sectionLeader: '李四',
      }),
    ]

    const results = partCheck(secondBatch, { tracker })
    const r02 = results.find((r) => r.recordId === 'R02')!

    expect(r02.status).toBe('pending_confirmation')
    expect(r02.versionDiff).toBeDefined()
    expect(r02.versionDiff?.noteAboutOldVersion).toBe(true)
    expect(r02.versionDiff?.summary).toContain('补传')
  })

  it('正常版本升级应展示差异但不标记为补传旧版本', () => {
    const tracker = new VersionTracker()

    const firstBatch = [
      makeRecord({
        id: 'R01',
        version: 1,
        keySignature: 'C',
        measureRange: [1, 32],
        partName: '小提琴I',
      }),
    ]
    partCheck(firstBatch, { tracker })

    const secondBatch = [
      makeRecord({
        id: 'R02',
        version: 2,
        keySignature: 'G',
        measureRange: [1, 32],
        partName: '小提琴I',
        previousVersionId: 'R01',
      }),
    ]

    const results = partCheck(secondBatch, { tracker })
    const r02 = results.find((r) => r.recordId === 'R02')!

    expect(r02.versionDiff).toBeDefined()
    expect(r02.versionDiff?.changedFields).toContain('keySignature')
    expect(r02.versionDiff?.noteAboutOldVersion).toBe(false)
  })
})

describe('report - 排练小结格式', () => {
  it('应生成包含统计和详情的可读报告', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', measureRange: [1, 32], partName: '中提琴', keySignature: 'G' }),
      makeRecord({ id: 'R03', measureRange: [33, 64], partName: '小提琴I', keySignature: 'C' }),
    ]

    const results = partCheck(records)
    const report = generateReport(results)
    const text = formatReportForManager(report)

    expect(text).toContain('弦乐分谱检查')
    expect(text).toContain('待确认')
    expect(text).toContain('判断原因')
    expect(text).toContain('下一步')
    expect(report.summary.total).toBe(3)
    expect(report.summary.pendingConfirmation).toBeGreaterThanOrEqual(2)
  })

  it('所有正常记录不应包含异常详情', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', measureRange: [33, 64], partName: '小提琴I', keySignature: 'C' }),
    ]

    const results = partCheck(records)
    const report = generateReport(results)
    const text = formatReportForManager(report)

    expect(text).toContain('检查通过')
    expect(report.summary.normal).toBe(2)
    expect(report.summary.pendingConfirmation).toBe(0)
  })
})

describe('partCheck - 关键异常宁可标待确认也不混入正常', () => {
  it('小节错位不应标记为 normal', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I' }),
      makeRecord({ id: 'R02', measureRange: [50, 64], partName: '小提琴I' }),
    ]

    const results = partCheck(records)
    for (const r of results) {
      expect(r.status).not.toBe('normal')
    }
  })

  it('转调未同步不应标记为 normal', () => {
    const records = [
      makeRecord({ id: 'R01', measureRange: [1, 32], partName: '小提琴I', keySignature: 'C' }),
      makeRecord({ id: 'R02', measureRange: [1, 32], partName: '大提琴', keySignature: 'D' }),
    ]

    const results = partCheck(records)
    for (const r of results) {
      expect(r.status).not.toBe('normal')
    }
  })

  it('重复学生统计不应标记为 normal', () => {
    const records = [
      makeRecord({ id: 'R01', studentName: '张三', measureRange: [1, 32], partName: '小提琴I' }),
      makeRecord({ id: 'R02', studentName: '张三', measureRange: [10, 40], partName: '中提琴' }),
    ]

    const results = partCheck(records)
    for (const r of results) {
      expect(r.status).not.toBe('normal')
    }
  })
})
