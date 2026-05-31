import type { RehearsalRecord, CheckResult, AnomalyDetail, VersionDiff } from './types.js'
import {
  checkMeasureMisalignment,
  checkTranspositionDesync,
  checkDuplicateStudent,
} from './checkers/index.js'
import { VersionTracker } from './versionTracker.js'

export interface PartCheckOptions {
  tracker?: VersionTracker
}

export function partCheck(
  records: RehearsalRecord[],
  options?: PartCheckOptions
): CheckResult[] {
  const tracker = options?.tracker ?? new VersionTracker()
  const versionDiffs = tracker.ingest(records)

  const allAnomalies: AnomalyDetail[] = [
    ...checkMeasureMisalignment(records),
    ...checkTranspositionDesync(records),
    ...checkDuplicateStudent(records),
  ]

  const anomalyMap = new Map<string, AnomalyDetail[]>()
  for (const a of allAnomalies) {
    for (const id of a.affectedRecordIds) {
      const existing = anomalyMap.get(id) ?? []
      existing.push(a)
      anomalyMap.set(id, existing)
    }
  }

  const versionDiffMap = new Map<string, VersionDiff>()
  for (const vd of versionDiffs) {
    const currentRecord = records.find((r) => r.previousVersionId === vd.previousVersionId)
    if (currentRecord) {
      versionDiffMap.set(currentRecord.id, vd)
    }
  }

  const results: CheckResult[] = records.map((record) => {
    const anomalies = anomalyMap.get(record.id) ?? []
    const versionDiff = versionDiffMap.get(record.id)

    const { status, reasons, nextSteps } = classifyRecord(
      record,
      anomalies,
      versionDiff
    )

    return {
      recordId: record.id,
      status,
      reasons,
      nextSteps,
      anomalies,
      versionDiff,
    }
  })

  return results
}

function classifyRecord(
  record: RehearsalRecord,
  anomalies: AnomalyDetail[],
  versionDiff?: VersionDiff
): { status: CheckResult['status']; reasons: string[]; nextSteps: string[] } {
  const reasons: string[] = []
  const nextSteps: string[] = []

  if (record.isLateAttachment) {
    reasons.push(
      `此记录为晚到附件（提交时间：${record.timestamp}），可能缺少与主批次的上下文关联。`
    )
    nextSteps.push('请确认该附件是否已与同批次其他记录对齐。')
  }

  if (record.isManualCorrection) {
    reasons.push(
      `此记录为人工更正${record.note ? `，备注："${record.note}"` : '，无备注说明'}。人工更正可能覆盖原始数据，需核实更正依据。`
    )
    nextSteps.push('请核实人工更正的依据是否充分，必要时附上原始数据对照。')
  }

  if (anomalies.length > 0) {
    const anomalyTypes = anomalies.map((a) => a.type)
    const hasCriticalAnomaly = anomalyTypes.some((t) =>
      ['measure_misalignment', 'transposition_desync', 'duplicate_student'].includes(t)
    )

    if (hasCriticalAnomaly) {
      for (const anomaly of anomalies) {
        reasons.push(anomaly.reasoning)
        nextSteps.push(anomaly.suggestion)
      }

      reasons.push(
        '以上异常属于关键类型（小节错位/转调未同步/重复统计），按规则标记为"待确认"，不纳入正常结果。'
      )
      nextSteps.push('待相关负责人确认后方可归入正常统计。')

      return { status: 'pending_confirmation', reasons, nextSteps }
    }
  }

  if (versionDiff?.noteAboutOldVersion) {
    reasons.push(versionDiff.summary)
    nextSteps.push(
      '请核实此补传记录是否应替代之前版本，确认后更新版本号。'
    )
    return { status: 'pending_confirmation', reasons, nextSteps }
  }

  if (anomalies.length === 0 && !record.isLateAttachment && !record.isManualCorrection && !versionDiff) {
    reasons.push('记录经检查未发现异常，小节范围连续、调号一致、无重复统计。')
    return { status: 'normal', reasons, nextSteps: [] }
  }

  if (reasons.length > 0) {
    return { status: 'pending_confirmation', reasons, nextSteps }
  }

  return { status: 'normal', reasons, nextSteps }
}

