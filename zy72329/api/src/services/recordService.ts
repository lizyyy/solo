import * as billRecordRepo from '../repositories/billRecordRepository'
import * as teacherNoteRepo from '../repositories/teacherNoteRepository'
import * as samplingListRepo from '../repositories/samplingListRepository'
import * as operationHistoryRepo from '../repositories/operationHistoryRepository'
import * as conflictRecordRepo from '../repositories/conflictRecordRepository'
import * as gapRecordRepo from '../repositories/gapRecordRepository'
import { generateId } from '../utils/idGenerator'
import type { BillRecord, OperationHistory, EvidenceItem, TeacherNote, SamplingList, RecordStatus, GapRecord, ConflictRecord } from '../../../shared/types'

function getRecords(status?: string): { records: BillRecord[]; total: number } {
  const records = billRecordRepo.findAll(status as RecordStatus)
  const total = billRecordRepo.count(status as RecordStatus)

  for (const record of records) {
    if (record.status === 'gap' || record.status === 'reviewed_normal' || record.status === 'reviewed_abnormal') {
      (record as BillRecord & { gapRecord?: GapRecord }).gapRecord = gapRecordRepo.findByRecordId(record.id)
    }
    if (record.status === 'conflict' || record.status === 'approved' || record.status === 'rejected') {
      (record as BillRecord & { conflictRecord?: ConflictRecord }).conflictRecord = conflictRecordRepo.findByRecordId(record.id)
    }
  }

  return { records, total }
}

function getRecordDetail(id: string): {
  record: BillRecord
  teacherNote?: TeacherNote
  samplingList?: SamplingList
  history: OperationHistory[]
  gapRecord?: GapRecord
  conflictRecord?: ConflictRecord
} {
  const record = billRecordRepo.findById(id)
  if (!record) {
    throw new Error(`记录 ${id} 不存在`)
  }

  const teacherNote = record.teacherNoteId
    ? teacherNoteRepo.findById(record.teacherNoteId)
    : undefined

  const samplingList = record.samplingListId
    ? samplingListRepo.findById(record.samplingListId)
    : undefined

  const history = operationHistoryRepo.findByRecordId(id)

  const gapRecord = (record.status === 'gap' || record.status === 'reviewed_normal' || record.status === 'reviewed_abnormal')
    ? gapRecordRepo.findByRecordId(id)
    : undefined

  const conflictRecord = (record.status === 'conflict' || record.status === 'approved' || record.status === 'rejected')
    ? conflictRecordRepo.findByRecordId(id)
    : undefined

  return {
    record,
    teacherNote,
    samplingList,
    history,
    gapRecord,
    conflictRecord,
  }
}

function getEvidenceChain(recordId: string): EvidenceItem[] {
  const detail = getRecordDetail(recordId)
  const evidence: EvidenceItem[] = []

  if (detail.teacherNote) {
    evidence.push({
      id: generateId(),
      type: 'teacher_note',
      source: '老师批注导入',
      content: `记录编号: ${detail.teacherNote.recordNo}, 日期: ${detail.teacherNote.date}, 教师: ${detail.teacherNote.teacherName}, 金额: ${detail.teacherNote.amount}, 项目: ${detail.teacherNote.itemType}, 批注: ${detail.teacherNote.annotation}`,
      timestamp: detail.teacherNote.importedAt,
      operator: detail.teacherNote.importedBy,
    })
  }

  if (detail.samplingList) {
    evidence.push({
      id: generateId(),
      type: 'sampling_list',
      source: '抽样名单导入',
      content: `记录编号: ${detail.samplingList.recordNo}, 日期: ${detail.samplingList.date}, 教师: ${detail.samplingList.teacherName}, 金额: ${detail.samplingList.amount}, 项目: ${detail.samplingList.itemType}, 场景: ${detail.samplingList.sceneDescription}, 旧口径: ${detail.samplingList.isOldFormat ? '是' : '否'}`,
      timestamp: detail.samplingList.importedAt,
      operator: detail.samplingList.importedBy,
    })
  }

  if (detail.record.status === 'gap') {
    const gapRecord = gapRecordRepo.findByRecordId(recordId)
    if (gapRecord) {
      evidence.push({
        id: generateId(),
        type: 'gap_detection',
        source: '系统断档检测',
        content: `检测到断档：缺失记录 ${gapRecord.missingRecordNo}，前序记录 ${gapRecord.previousRecordNo}，后序记录 ${gapRecord.nextRecordNo}，复核状态: ${gapRecord.reviewStatus}`,
        timestamp: gapRecord.createdAt,
        operator: 'system',
      })

      if (gapRecord.reviewStatus !== 'pending' && gapRecord.reviewedBy) {
        evidence.push({
          id: generateId(),
          type: 'gap_review',
          source: '教研组复核',
          content: `断档复核结果: ${gapRecord.reviewStatus === 'normal' ? '正常' : '异常'}，备注: ${gapRecord.reviewNote || '无'}`,
          timestamp: gapRecord.reviewedAt || gapRecord.createdAt,
          operator: gapRecord.reviewedBy,
        })
      }
    }
  }

  if (detail.record.status === 'conflict') {
    const conflictRecord = conflictRecordRepo.findByRecordId(recordId)
    if (conflictRecord) {
      const conflictDesc = conflictRecord.conflictingFields
        .map((f) => `${f.field}: 老师批注=${f.teacherNoteValue}, 抽样名单=${f.samplingListValue}`)
        .join('; ')

      evidence.push({
        id: generateId(),
        type: 'conflict_detection',
        source: '系统冲突检测',
        content: `检测到字段冲突：${conflictDesc}`,
        timestamp: conflictRecord.createdAt,
        operator: 'system',
      })

      if (conflictRecord.resolution && conflictRecord.resolvedBy) {
        evidence.push({
          id: generateId(),
          type: 'conflict_resolve',
          source: '人工冲突处理',
          content: `冲突处理结果: ${conflictRecord.resolution}，备注: ${conflictRecord.resolutionNote || '无'}`,
          timestamp: conflictRecord.resolvedAt || conflictRecord.createdAt,
          operator: conflictRecord.resolvedBy,
        })
      }
    }
  }

  for (const hist of detail.history) {
    evidence.push({
      id: generateId(),
      type: hist.operationType,
      source: '操作历史',
      content: hist.description,
      timestamp: hist.createdAt,
      operator: hist.operator,
    })
  }

  evidence.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return evidence
}

export { getRecords, getRecordDetail, getEvidenceChain }
