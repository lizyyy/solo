import type { CraneRecord, ValidationStep } from '@/types'
import { DEFAULT_THRESHOLDS } from '@/types'
import { normalizeAngle, normalizeLength, normalizeTime } from '@/utils/physics'

let stepCounter = 0

function nextStepId(): string {
  stepCounter += 1
  return `vs-${Date.now()}-${stepCounter}`
}

export function validateRecord(
  record: CraneRecord,
  existingRecords: CraneRecord[] = []
): ValidationStep[] {
  const steps: ValidationStep[] = []
  const now = Date.now()

  const angleDeg = normalizeAngle(record.swingAngle, record.swingAngleUnit)
  const ropeLengthM = normalizeLength(record.ropeLength, record.ropeLengthUnit)
  const intervalS = normalizeTime(record.sampleInterval, record.sampleIntervalUnit)

  if (record.swingAngleUnit === 'rad') {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'angle_unit',
      result: 'warn',
      message: `角度单位为 rad(${record.swingAngle})，已自动换算为 deg(${angleDeg.toFixed(2)}°)`,
      timestamp: now,
    })
  } else {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'angle_unit',
      result: 'pass',
      message: '角度单位一致(deg)',
      timestamp: now,
    })
  }

  if (record.ropeLengthUnit === 'cm') {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'length_unit',
      result: 'warn',
      message: `绳长单位为 cm(${record.ropeLength})，已换算为 m(${ropeLengthM.toFixed(2)})`,
      timestamp: now,
    })
  } else {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'length_unit',
      result: 'pass',
      message: '绳长单位一致(m)',
      timestamp: now,
    })
  }

  const lastRecord = existingRecords.length > 0 ? existingRecords[existingRecords.length - 1] : null
  if (lastRecord && lastRecord.direction !== record.direction) {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'direction',
      result: 'warn',
      message: `方向符号与上一条记录相反(上条${lastRecord.direction}，本条${record.direction})，请确认是否正确`,
      timestamp: now,
    })
  } else {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'direction',
      result: 'pass',
      message: `方向符号一致(${record.direction})`,
      timestamp: now,
    })
  }

  if (intervalS < DEFAULT_THRESHOLDS.minSampleInterval) {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'sample_interval',
      result: 'fail',
      message: `采样间隔异常(${intervalS.toFixed(3)}s < ${DEFAULT_THRESHOLDS.minSampleInterval}s)，可能存在数据重复`,
      timestamp: now,
    })
  } else if (intervalS > DEFAULT_THRESHOLDS.maxSampleInterval) {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'sample_interval',
      result: 'fail',
      message: `采样间隔异常(${intervalS.toFixed(2)}s > ${DEFAULT_THRESHOLDS.maxSampleInterval}s)，可能存在数据缺失`,
      timestamp: now,
    })
  } else {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'sample_interval',
      result: 'pass',
      message: `采样间隔正常(${intervalS.toFixed(2)}s)`,
      timestamp: now,
    })
  }

  if (angleDeg > DEFAULT_THRESHOLDS.maxSwingAngle) {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'threshold_angle',
      result: 'fail',
      message: `摆角超过 ${DEFAULT_THRESHOLDS.maxSwingAngle}° 安全阈值(当前${angleDeg.toFixed(2)}°)，需人工确认`,
      timestamp: now,
    })
  } else if (angleDeg > DEFAULT_THRESHOLDS.maxSwingAngle * 0.9) {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'threshold_angle',
      result: 'warn',
      message: `摆角接近 ${DEFAULT_THRESHOLDS.maxSwingAngle}° 安全阈值(当前${angleDeg.toFixed(2)}°)，建议留意`,
      timestamp: now,
    })
  } else {
    steps.push({
      id: nextStepId(),
      recordId: record.id,
      checkType: 'threshold_angle',
      result: 'pass',
      message: `摆角正常(${angleDeg.toFixed(2)}°)`,
      timestamp: now,
    })
  }

  return steps
}

export function determineStatus(steps: ValidationStep[]): CraneRecord['status'] {
  const hasFail = steps.some(s => s.result === 'fail')
  const hasWarn = steps.some(s => s.result === 'warn')
  if (hasFail) return 'needs_review'
  if (hasWarn) return 'needs_review'
  return 'pass'
}

export function isException(steps: ValidationStep[]): boolean {
  return steps.some(s => s.result === 'fail')
}
