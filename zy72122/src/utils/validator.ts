import type {
  ExperimentRecord,
  CheckResult,
  ValidationResult,
  ValidationConfig,
} from '@/types'

const DIRECTION_SYMBOLS = ['+', '-']

function checkDirection(record: ExperimentRecord): CheckResult {
  const valid = DIRECTION_SYMBOLS.includes(record.direction)
  return {
    type: 'direction',
    passed: valid,
    message: valid
      ? `方向符号 "${record.direction}" 正确`
      : `方向符号 "${record.direction}" 无效，应为 "+" 或 "-"`,
    suggestion: valid ? undefined : '请将方向修正为 "+" 或 "-"',
  }
}

function checkUnit(record: ExperimentRecord, config: ValidationConfig): CheckResult {
  const mismatches: string[] = []

  if (record.displacementUnit !== config.expectedDisplacementUnit) {
    mismatches.push(
      `位移单位 "${record.displacementUnit}" 与期望 "${config.expectedDisplacementUnit}" 不一致`
    )
  }
  if (record.forceUnit !== config.expectedForceUnit) {
    mismatches.push(
      `力单位 "${record.forceUnit}" 与期望 "${config.expectedForceUnit}" 不一致`
    )
  }
  if (record.stiffnessUnit !== config.expectedStiffnessUnit) {
    mismatches.push(
      `刚度单位 "${record.stiffnessUnit}" 与期望 "${config.expectedStiffnessUnit}" 不一致`
    )
  }

  return {
    type: 'unit',
    passed: mismatches.length === 0,
    message:
      mismatches.length === 0
        ? '所有单位与期望一致'
        : `单位不一致：${mismatches.join('；')}`,
    suggestion:
      mismatches.length > 0
        ? `建议统一为目标单位：位移(${config.expectedDisplacementUnit})、力(${config.expectedForceUnit})、刚度(${config.expectedStiffnessUnit})`
        : undefined,
  }
}

function checkInterval(
  record: ExperimentRecord,
  prevRecord: ExperimentRecord | null,
  config: ValidationConfig
): CheckResult {
  if (!prevRecord) {
    return { type: 'interval', passed: true, message: '首条记录，无需检查时间间隔' }
  }

  const current = new Date(record.timestamp).getTime()
  const prev = new Date(prevRecord.timestamp).getTime()

  if (isNaN(current) || isNaN(prev)) {
    return {
      type: 'interval',
      passed: false,
      message: '时间戳格式无效，无法计算间隔',
      suggestion: '请检查时间戳格式，推荐 ISO 8601 格式（如 2026-01-15T10:30:00）',
    }
  }

  const interval = current - prev

  if (interval <= 0) {
    return {
      type: 'interval',
      passed: false,
      message: `时间间隔异常：当前记录时间早于或等于前一条（间隔 ${interval}ms）`,
      suggestion: '请检查时间戳顺序是否正确',
    }
  }

  if (interval > config.maxIntervalMs) {
    return {
      type: 'interval',
      passed: false,
      message: `时间间隔过大：${(interval / 1000).toFixed(1)}s，超过最大允许间隔 ${config.maxIntervalMs / 1000}s`,
      suggestion: '可能存在采样缺口，请确认是否有遗漏数据',
    }
  }

  if (interval < config.minIntervalMs) {
    return {
      type: 'interval',
      passed: false,
      message: `时间间隔过小：${interval}ms，低于最小允许间隔 ${config.minIntervalMs}ms`,
      suggestion: '请确认采样频率是否正常',
    }
  }

  return {
    type: 'interval',
    passed: true,
    message: `时间间隔正常：${(interval / 1000).toFixed(1)}s`,
  }
}

function checkGap(record: ExperimentRecord, prevRecord: ExperimentRecord | null): CheckResult {
  if (!prevRecord) {
    return { type: 'gap', passed: true, message: '首条记录，无需检查采样缺口' }
  }

  const current = new Date(record.timestamp).getTime()
  const prev = new Date(prevRecord.timestamp).getTime()

  if (isNaN(current) || isNaN(prev)) {
    return {
      type: 'gap',
      passed: false,
      message: '时间戳格式无效，无法检测采样缺口',
    }
  }

  const displacementDiff = Math.abs(record.displacement - prevRecord.displacement)
  const forceDiff = Math.abs(record.force - prevRecord.force)

  const displacementJump = displacementDiff > 20
  const forceJump = forceDiff > 15

  if (displacementJump || forceJump) {
    const details: string[] = []
    if (displacementJump) details.push(`位移跳变 ${displacementDiff.toFixed(1)}mm`)
    if (forceJump) details.push(`力跳变 ${forceDiff.toFixed(1)}N`)

    return {
      type: 'gap',
      passed: false,
      message: `检测到采样缺口：${details.join('，')}`,
      suggestion: '请确认是否有中间数据遗漏，或现场是否有异常操作',
    }
  }

  return { type: 'gap', passed: true, message: '无明显采样缺口' }
}

function checkThreshold(record: ExperimentRecord, config: ValidationConfig): CheckResult {
  const issues: string[] = []

  if (record.force > config.forceThresholdMax) {
    issues.push(`力 ${record.force}${record.forceUnit} 超过安全上限 ${config.forceThresholdMax}${config.expectedForceUnit}`)
  }
  if (record.force < config.forceThresholdMin) {
    issues.push(`力 ${record.force}${record.forceUnit} 低于安全下限 ${config.forceThresholdMin}${config.expectedForceUnit}`)
  }
  if (record.displacement > config.displacementThresholdMax) {
    issues.push(`位移 ${record.displacement}${record.displacementUnit} 超过安全上限 ${config.displacementThresholdMax}${config.expectedDisplacementUnit}`)
  }
  if (record.displacement < config.displacementThresholdMin) {
    issues.push(`位移 ${record.displacement}${record.displacementUnit} 低于安全下限 ${config.displacementThresholdMin}${config.expectedDisplacementUnit}`)
  }

  return {
    type: 'threshold',
    passed: issues.length === 0,
    message: issues.length === 0 ? '所有数值在安全阈值内' : `超安全阈值：${issues.join('；')}`,
    suggestion:
      issues.length > 0
        ? '该记录需要人工确认，请核对现场照片和原始记录'
        : undefined,
  }
}

export function validateRecord(
  record: ExperimentRecord,
  prevRecord: ExperimentRecord | null,
  config: ValidationConfig
): ValidationResult {
  const checks: CheckResult[] = [
    checkDirection(record),
    checkUnit(record, config),
    checkInterval(record, prevRecord, config),
    checkGap(record, prevRecord),
    checkThreshold(record, config),
  ]

  const hasError = checks.some((c) => !c.passed && c.type === 'threshold')
  const hasWarning = checks.some((c) => !c.passed && c.type !== 'threshold')

  let status: ValidationResult['status'] = 'pass'
  if (hasError) status = 'error'
  else if (hasWarning) status = 'warning'

  return {
    recordId: record.id,
    checks,
    status,
  }
}

export function validateAll(
  records: ExperimentRecord[],
  config: ValidationConfig
): ValidationResult[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return sorted.map((record, index) => {
    let prev: ExperimentRecord | null = null
    for (let i = index - 1; i >= 0; i--) {
      if (sorted[i].source.type !== 'legacy') {
        prev = sorted[i]
        break
      }
    }
    return validateRecord(record, prev, config)
  })
}

export function determineRecordStatus(
  validationResult: ValidationResult,
  sourceType?: string
): ExperimentRecord['status'] {
  const thresholdFailed = validationResult.checks.find(
    (c) => c.type === 'threshold' && !c.passed
  )
  if (thresholdFailed) return 'needs_review'

  if (sourceType === 'legacy') return 'legacy_amended'

  const anyFailed = validationResult.checks.some((c) => !c.passed)
  if (anyFailed) return 'needs_review'

  return 'passed'
}
