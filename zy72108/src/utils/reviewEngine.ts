import type { StringMeasurement, ThresholdVersion, StringName, Batch, Conflict, AuditLog, ParameterRecord } from '@/types'
import { uid } from '@/data/mockData'

export function calculateDeviation(measured: number, standard: number): number {
  return Math.round(((measured - standard) / standard) * 10000) / 100
}

export function detectAnomalies(
  measurements: StringMeasurement[],
  threshold: ThresholdVersion
): StringMeasurement[] {
  return measurements.map((m) => {
    const maxDev = threshold.thresholds[m.stringName]
    const isAnomaly = Math.abs(m.deviationRate) > maxDev
    const anomalyReason = isAnomaly
      ? `${m.stringName}偏差率${m.deviationRate > 0 ? '+' : ''}${m.deviationRate}%超出阈值±${maxDev}%（阈值版本${threshold.version}）`
      : ''
    return { ...m, isAnomaly, anomalyReason }
  })
}

export function detectConflicts(batch: Batch): Conflict[] {
  const conflicts: Conflict[] = []
  const recordsWithMeasurements = batch.parameterRecords.filter(
    (r) => r.measurements.length > 0
  )
  if (recordsWithMeasurements.length < 2) return conflicts

  const inspectionRecord = recordsWithMeasurements.find(
    (r) => r.source === '照片说明'
  )
  const experimentRecord = recordsWithMeasurements.find(
    (r) => r.source === '实验表'
  )

  if (!inspectionRecord || !experimentRecord) return conflicts

  for (const expM of experimentRecord.measurements) {
    const inspM = inspectionRecord.measurements.find(
      (m) => m.stringName === expM.stringName
    )
    if (!inspM) continue

    const diff = Math.abs(expM.measuredTension - inspM.measuredTension)
    if (diff > 1.0) {
      const expDev = calculateDeviation(expM.measuredTension, expM.standardTension)
      const inspDev = calculateDeviation(inspM.measuredTension, inspM.standardTension)
      conflicts.push({
        id: uid(),
        batchId: batch.id,
        parameterName: `${expM.stringName}张力`,
        importValue: `${expM.measuredTension}N（偏差${expDev > 0 ? '+' : ''}${expDev}%）`,
        importSource: experimentRecord.source,
        inspectionValue: `${inspM.measuredTension}N（偏差${inspDev > 0 ? '+' : ''}${inspDev}%）`,
        inspectionSource: inspectionRecord.source,
        suggestion: `实验表实测${expM.measuredTension}N与巡检表${inspM.measuredTension}N差异${diff.toFixed(1)}N，建议复核${expM.stringName}实际工况，确认是否因温控波动导致测量偏差`,
      })
    }
  }

  return conflicts
}

export function createAuditLog(
  batchId: string,
  action: string,
  actor: string,
  thresholdVersionId: string,
  thresholdVersion: string,
  source: string,
  reason: string,
  details: Record<string, unknown> = {}
): AuditLog {
  return {
    id: uid(),
    batchId,
    action,
    actor,
    timestamp: new Date().toISOString(),
    thresholdVersionId,
    thresholdVersion,
    source,
    reason,
    details,
  }
}

export function createNewBatch(name: string): Batch {
  return {
    id: `batch_${uid()}`,
    name,
    experimentType: '小提琴琴弦张力复核',
    createdAt: new Date().toISOString(),
    status: 'pending',
    parameterRecords: [],
    conflicts: [],
    auditLogs: [],
  }
}

export function createParameterRecord(
  batchId: string,
  source: ParameterRecord['source'],
  sourceDescription: string,
  measurements: StringMeasurement[],
  environment: Batch['parameterRecords'][0]['environment']
): ParameterRecord {
  const recordId = uid()
  return {
    id: recordId,
    batchId,
    source,
    recordedAt: new Date().toISOString(),
    sourceDescription,
    measurements: measurements.map((m) => ({ ...m, recordId })),
    environment: environment ? { ...environment, recordId } : null,
  }
}

export function createMeasurement(
  stringName: StringName,
  standardTension: number,
  measuredTension: number
): StringMeasurement {
  return {
    id: uid(),
    recordId: '',
    stringName,
    standardTension,
    measuredTension,
    deviationRate: calculateDeviation(measuredTension, standardTension),
    isAnomaly: false,
    anomalyReason: '',
  }
}

export function createThresholdVersion(
  currentVersion: string,
  thresholds: Record<StringName, number>,
  changeReason: string,
  changedBy: string
): ThresholdVersion {
  const versionNum = parseFloat(currentVersion.replace('v', ''))
  const newVersion = `v${(versionNum + 0.1).toFixed(1)}`
  return {
    id: `tv_${uid()}`,
    version: newVersion,
    thresholds,
    effectiveAt: new Date().toISOString(),
    changeReason,
    changedBy,
  }
}

export function getThresholdForString(threshold: ThresholdVersion, stringName: StringName): number {
  return threshold.thresholds[stringName]
}

export function getAllMeasurements(batch: Batch): StringMeasurement[] {
  return batch.parameterRecords.flatMap((r) => r.measurements)
}

export function getPrimaryMeasurements(batch: Batch): StringMeasurement[] {
  const experimentRecord = batch.parameterRecords.find((r) => r.source === '实验表')
  if (experimentRecord) return experimentRecord.measurements
  const firstWithMeasurements = batch.parameterRecords.find((r) => r.measurements.length > 0)
  return firstWithMeasurements?.measurements ?? []
}

export function getEnvironment(batch: Batch): Batch['parameterRecords'][0]['environment'] {
  const record = batch.parameterRecords.find((r) => r.environment !== null)
  return record?.environment ?? null
}
