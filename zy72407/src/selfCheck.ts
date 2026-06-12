import { v4 as uuidv4 } from 'uuid'
import {
  ConsumptionRecord,
  SelfCheckResult,
  SelfCheckIssue,
  RecordStatus,
  ReviewFlag,
  ImportBatch
} from './types'

function generateIssue(
  type: SelfCheckIssue['type'],
  severity: SelfCheckIssue['severity'],
  message: string,
  recordIds: string[],
  details?: any
): SelfCheckIssue {
  return {
    id: uuidv4(),
    type,
    severity,
    message,
    recordIds,
    details
  }
}

export function detectDuplicates(records: ConsumptionRecord[]): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []
  const seen = new Map<string, string[]>()

  records.forEach(record => {
    const key = `${record.studentName}|${record.courseDate}|${record.courseTime}|${record.teacherName}`
    if (seen.has(key)) {
      seen.get(key)!.push(record.id)
    } else {
      seen.set(key, [record.id])
    }
  })

  seen.forEach((recordIds, key) => {
    if (recordIds.length > 1) {
      const duplicateRecords = records.filter(r => recordIds.includes(r.id))
      const hasTunerMatch = duplicateRecords.some(r => r.tunerMessageId)
      const hasGroupMatch = duplicateRecords.some(r => r.groupSignupId)
      
      issues.push(generateIssue(
        'duplicate',
        'high',
        `发现重复记录: ${key}，共 ${recordIds.length} 条`,
        recordIds,
        {
          key,
          hasTunerMatch,
          hasGroupMatch,
          details: duplicateRecords.map(r => ({
            id: r.id,
            status: r.status,
            tunerLine: r.tunerOriginalLineNumber,
            groupLine: r.groupOriginalLineNumber
          }))
        }
      ))
    }
  })

  return issues
}

export function detectTempSubstitutes(records: ConsumptionRecord[]): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []

  records.forEach(record => {
    if (record.reviewFlag === ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
      issues.push(generateIssue(
        'temp_substitute',
        'medium',
        `临时替补记录待复核: ${record.studentName} ${record.courseDate} ${record.courseTime}，仅在群接龙中有记录，调音师留言未提及`,
        [record.id],
        {
          studentName: record.studentName,
          courseDate: record.courseDate,
          courseTime: record.courseTime,
          groupRawContent: record.groupRawContent,
          groupLineNumber: record.groupOriginalLineNumber
        }
      ))
    }
  })

  return issues
}

export function detectMismatches(records: ConsumptionRecord[]): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []

  records.forEach(record => {
    if (record.tunerMessageId && record.groupSignupId && record.groupCourseTime) {
      const tunerTime = record.courseTime
      const groupTime = record.groupCourseTime
      
      if (tunerTime !== groupTime && tunerTime && groupTime) {
        issues.push(generateIssue(
          'mismatch',
          'high',
          `口径不一致: ${record.studentName} ${record.courseDate}，调音师留言记录${tunerTime}，群接龙记录${groupTime}`,
          [record.id],
          {
            tunerTime,
            groupTime,
            tunerLine: record.tunerOriginalLineNumber,
            groupLine: record.groupOriginalLineNumber,
            tunerRawContent: record.tunerRawContent,
            groupRawContent: record.groupRawContent
          }
        ))
      }
    }
  })

  return issues
}

export function detectMissingData(records: ConsumptionRecord[]): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []

  records.forEach(record => {
    const missing: string[] = []
    
    if (!record.studentName) missing.push('学生姓名')
    if (!record.courseDate) missing.push('上课日期')
    if (!record.teacherName) missing.push('老师姓名')
    if (record.durationMinutes <= 0) missing.push('课时时长')

    if (missing.length > 0) {
      issues.push(generateIssue(
        'missing_data',
        'high',
        `记录缺少必要字段: ${record.studentName || '未知学生'}，缺少 ${missing.join(', ')}`,
        [record.id],
        { missingFields: missing }
      ))
    }
  })

  return issues
}

export function verifyExportConsistency(
  records: ConsumptionRecord[],
  exportedData: any[]
): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []

  if (records.length !== exportedData.length) {
    const recordIds = records.map(r => r.id)
    issues.push(generateIssue(
      'inconsistent',
      'high',
      `导出数据条数不一致: 系统内 ${records.length} 条，导出 ${exportedData.length} 条`,
      recordIds
    ))
  }

  const recordMap = new Map(records.map(r => [r.id, r]))
  exportedData.forEach((exported, index) => {
    const record = recordMap.get(exported.id)
    if (!record) {
      issues.push(generateIssue(
        'inconsistent',
        'high',
        `导出数据第 ${index + 1} 条在系统中不存在`,
        [exported.id]
      ))
      return
    }

    const inconsistentFields: string[] = []
    
    if (exported.studentName !== record.studentName) inconsistentFields.push('studentName')
    if (exported.courseDate !== record.courseDate) inconsistentFields.push('courseDate')
    if (exported.courseTime !== record.courseTime) inconsistentFields.push('courseTime')
    if (exported.teacherName !== record.teacherName) inconsistentFields.push('teacherName')
    if (exported.status !== record.status) inconsistentFields.push('status')
    if (exported.reviewFlag !== record.reviewFlag) inconsistentFields.push('reviewFlag')
    if (exported.durationMinutes !== record.durationMinutes) inconsistentFields.push('durationMinutes')
    if (exported.settlementAmount !== record.settlementAmount) inconsistentFields.push('settlementAmount')

    if (inconsistentFields.length > 0) {
      issues.push(generateIssue(
        'inconsistent',
        'high',
        `导出数据与系统不一致: ${record.studentName}，字段 ${inconsistentFields.join(', ')}`,
        [record.id],
        { inconsistentFields }
      ))
    }
  })

  return issues
}

export function recalculateAfterSupplement(records: ConsumptionRecord[]): ConsumptionRecord[] {
  const now = new Date().toISOString()

  return records.map(record => {
    const updated = { ...record, updatedAt: now }

    if (record.status === RecordStatus.NEEDS_REVIEW && record.reviewFlag === ReviewFlag.MISMATCH) {
      return updated
    }

    if (record.status === RecordStatus.NEEDS_REVIEW && record.reviewFlag === ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
      return updated
    }

    if (updated.tunerMessageId && updated.groupSignupId && updated.reviewFlag === ReviewFlag.NONE) {
      updated.status = RecordStatus.MATCHED
    }

    if (updated.durationMinutes > 0 && !updated.settlementAmount && updated.status !== RecordStatus.NEEDS_REVIEW) {
      const ratePerMinute = 2
      updated.settlementAmount = updated.durationMinutes * ratePerMinute
    }

    return updated
  })
}

export function runSelfCheck(
  records: ConsumptionRecord[],
  batches: ImportBatch[],
  exportedData?: any[]
): SelfCheckResult {
  const issues: SelfCheckIssue[] = []

  issues.push(...detectDuplicates(records))
  issues.push(...detectTempSubstitutes(records))
  issues.push(...detectMismatches(records))
  issues.push(...detectMissingData(records))

  if (exportedData) {
    issues.push(...verifyExportConsistency(records, exportedData))
  }

  const highSeverity = issues.filter(i => i.severity === 'high').length
  const passed = highSeverity === 0

  return {
    checkedAt: new Date().toISOString(),
    totalRecords: records.length,
    issues,
    passed
  }
}

export function markDuplicates(records: ConsumptionRecord[]): ConsumptionRecord[] {
  const seen = new Map<string, string[]>()
  const now = new Date().toISOString()

  records.forEach(record => {
    const key = `${record.studentName}|${record.courseDate}|${record.courseTime}|${record.teacherName}`
    if (seen.has(key)) {
      seen.get(key)!.push(record.id)
    } else {
      seen.set(key, [record.id])
    }
  })

  return records.map(record => {
    const key = `${record.studentName}|${record.courseDate}|${record.courseTime}|${record.teacherName}`
    const duplicates = seen.get(key) || []
    
    if (duplicates.length > 1 && duplicates[0] !== record.id) {
      return {
        ...record,
        status: RecordStatus.DUPLICATE,
        updatedAt: now
      }
    }
    
    return record
  })
}
