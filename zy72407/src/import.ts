import { v4 as uuidv4 } from 'uuid'
import {
  TunerMessageRaw,
  GroupSignupRaw,
  ImportBatch,
  DataSource,
  ConsumptionRecord,
  RecordStatus,
  ReviewFlag
} from './types'

export function parseTunerMessage(
  lines: string[],
  batchId: string,
  operator: string
): { batch: ImportBatch; records: TunerMessageRaw[] } {
  const now = new Date().toISOString()
  const records: TunerMessageRaw[] = []

  lines.forEach((line, index) => {
    if (!line.trim()) return

    const parts = line.split(/[，,|\t]+/).map(p => p.trim())
    if (parts.length < 5) return

    const record: TunerMessageRaw = {
      id: uuidv4(),
      originalLineNumber: index + 1,
      rawContent: line,
      studentName: parts[0] || '',
      courseDate: parts[1] || '',
      courseTime: parts[2] || '',
      teacherName: parts[3] || '',
      courseType: parts[4] || '陪练',
      durationMinutes: parseInt(parts[5]) || 45,
      remark: parts[6],
      importBatchId: batchId,
      importedAt: now
    }

    records.push(record)
  })

  const batch: ImportBatch = {
    id: batchId,
    source: DataSource.TUNER_MESSAGE,
    fileName: `tuner_${batchId}.txt`,
    importedAt: now,
    operator,
    recordCount: records.length,
    rawData: lines
  }

  return { batch, records }
}

export function parseGroupSignup(
  lines: string[],
  batchId: string,
  operator: string
): { batch: ImportBatch; records: GroupSignupRaw[] } {
  const now = new Date().toISOString()
  const records: GroupSignupRaw[] = []

  lines.forEach((line, index) => {
    if (!line.trim()) return

    const parts = line.split(/[，,|\t]+/).map(p => p.trim())
    if (parts.length < 4) return

    const isOnSite = parts.some(p => 
      p.includes('现场') || p.includes('到') || p.includes('是')
    )

    const record: GroupSignupRaw = {
      id: uuidv4(),
      originalLineNumber: index + 1,
      rawContent: line,
      studentName: parts[0] || '',
      courseDate: parts[1] || '',
      courseTime: parts[2] || '',
      teacherName: parts[3] || '',
      isOnSite,
      remark: parts[4],
      importBatchId: batchId,
      importedAt: now
    }

    records.push(record)
  })

  const batch: ImportBatch = {
    id: batchId,
    source: DataSource.GROUP_SIGNUP,
    fileName: `group_${batchId}.txt`,
    importedAt: now,
    operator,
    recordCount: records.length,
    rawData: lines
  }

  return { batch, records }
}

export function createConsumptionRecordsFromTuner(
  tunerRecords: TunerMessageRaw[]
): ConsumptionRecord[] {
  const now = new Date().toISOString()

  return tunerRecords.map(tuner => ({
    id: uuidv4(),
    studentName: tuner.studentName,
    courseDate: tuner.courseDate,
    courseTime: tuner.courseTime,
    teacherName: tuner.teacherName,
    courseType: tuner.courseType,
    durationMinutes: tuner.durationMinutes,
    isOnSite: false,
    
    status: RecordStatus.IMPORTED,
    reviewFlag: ReviewFlag.NONE,
    
    tunerMessageId: tuner.id,
    tunerOriginalLineNumber: tuner.originalLineNumber,
    tunerRawContent: tuner.rawContent,
    importSource: 'tuner_first',
    
    manualEdits: [],
    createdAt: now,
    updatedAt: now
  }))
}

export function mergeGroupSignupToRecords(
  existingRecords: ConsumptionRecord[],
  groupRecords: GroupSignupRaw[]
): ConsumptionRecord[] {
  const now = new Date().toISOString()
  const updatedRecords = existingRecords.map(r => ({ ...r }))
  const usedGroupIds = new Set<string>()

  updatedRecords.forEach(record => {
    const exactMatch = groupRecords.find(group => {
      if (usedGroupIds.has(group.id)) return false
      return (
        group.studentName === record.studentName &&
        group.courseDate === record.courseDate &&
        group.courseTime === record.courseTime &&
        group.teacherName === record.teacherName
      )
    })

    if (exactMatch) {
      usedGroupIds.add(exactMatch.id)
      record.groupSignupId = exactMatch.id
      record.groupOriginalLineNumber = exactMatch.originalLineNumber
      record.groupRawContent = exactMatch.rawContent
      record.groupCourseTime = exactMatch.courseTime
      record.isOnSite = exactMatch.isOnSite
      record.status = RecordStatus.MATCHED
      record.reviewFlag = ReviewFlag.NONE
      record.matchedBy = 'auto'
      record.matchedAt = now
      record.updatedAt = now
      record.manualEdits = [
        ...record.manualEdits,
        {
          id: uuidv4(),
          timestamp: now,
          operator: 'system',
          action: 'auto_match',
          fieldName: 'groupSignupId',
          newValue: exactMatch.id,
          reason: '调音师留言与群接龙完全匹配(姓名+日期+时间+老师)'
        }
      ]
      return
    }

    const fuzzyMatch = groupRecords.find(group => {
      if (usedGroupIds.has(group.id)) return false
      return (
        group.studentName === record.studentName &&
        group.courseDate === record.courseDate &&
        group.teacherName === record.teacherName &&
        group.courseTime !== record.courseTime
      )
    })

    if (fuzzyMatch) {
      usedGroupIds.add(fuzzyMatch.id)
      record.groupSignupId = fuzzyMatch.id
      record.groupOriginalLineNumber = fuzzyMatch.originalLineNumber
      record.groupRawContent = fuzzyMatch.rawContent
      record.groupCourseTime = fuzzyMatch.courseTime
      record.isOnSite = fuzzyMatch.isOnSite
      record.status = RecordStatus.NEEDS_REVIEW
      record.reviewFlag = ReviewFlag.MISMATCH
      record.updatedAt = now
      record.manualEdits = [
        ...record.manualEdits,
        {
          id: uuidv4(),
          timestamp: now,
          operator: 'system',
          action: 'mismatch_detected',
          fieldName: 'courseTime',
          oldValue: `调音师留言: ${record.courseTime}`,
          newValue: `群接龙: ${fuzzyMatch.courseTime}`,
          reason: `口径不一致: 调音师留言记录${record.courseTime}，群接龙记录${fuzzyMatch.courseTime}，需票务同事复核`
        }
      ]
    }
  })

  groupRecords.forEach(group => {
    if (!usedGroupIds.has(group.id)) {
      const isTempSub = group.remark?.includes('临时') || 
                        group.remark?.includes('替补') ||
                        group.rawContent.includes('临时') ||
                        group.rawContent.includes('替补')

      const newRecord: ConsumptionRecord = {
        id: uuidv4(),
        studentName: group.studentName,
        courseDate: group.courseDate,
        courseTime: group.courseTime,
        teacherName: group.teacherName,
        courseType: '陪练',
        durationMinutes: 45,
        isOnSite: group.isOnSite,
        
        status: isTempSub ? RecordStatus.NEEDS_REVIEW : RecordStatus.IMPORTED,
        reviewFlag: isTempSub ? ReviewFlag.TEMP_SUB_ONLY_IN_GROUP : ReviewFlag.NONE,
        
        groupSignupId: group.id,
        groupOriginalLineNumber: group.originalLineNumber,
        groupRawContent: group.rawContent,
        groupCourseTime: group.courseTime,
        importSource: 'group_only',
        
        manualEdits: isTempSub ? [{
          id: uuidv4(),
          timestamp: now,
          operator: 'system',
          action: 'temp_sub_detected',
          reason: '临时替补仅在群接龙中说了一句，调音师留言未提及，不自动归正常，留给票务同事复核'
        }] : [],
        createdAt: now,
        updatedAt: now
      }

      updatedRecords.push(newRecord)
    }
  })

  return updatedRecords
}
