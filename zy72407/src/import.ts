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
  const updatedRecords = [...existingRecords]
  const usedGroupIds = new Set<string>()

  updatedRecords.forEach(record => {
    const match = groupRecords.find(group => {
      if (usedGroupIds.has(group.id)) return false
      return (
        group.studentName === record.studentName &&
        group.courseDate === record.courseDate &&
        (group.courseTime === record.courseTime || 
         group.teacherName === record.teacherName)
      )
    })

    if (match) {
      usedGroupIds.add(match.id)
      record.groupSignupId = match.id
      record.groupOriginalLineNumber = match.originalLineNumber
      record.groupRawContent = match.rawContent
      record.isOnSite = match.isOnSite
      record.status = RecordStatus.MATCHED
      record.matchedBy = 'auto'
      record.matchedAt = now
      record.updatedAt = now
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
        
        manualEdits: [],
        createdAt: now,
        updatedAt: now
      }

      updatedRecords.push(newRecord)
    }
  })

  return updatedRecords
}
