import { db } from '../db'
import {
  batchCreate as batchCreateTeacherNote,
  findByRecordNo as findTeacherNoteByRecordNo,
  findAll as findAllTeacherNotes,
  findById as findTeacherNoteById,
} from '../repositories/teacherNoteRepository'
import {
  batchCreate as batchCreateSamplingList,
  findById as findSamplingListById,
} from '../repositories/samplingListRepository'
import {
  create as createBillRecord,
  update as updateBillRecord,
  findByRecordNo as findBillRecordByRecordNo,
} from '../repositories/billRecordRepository'
import { create as createConflictRecord } from '../repositories/conflictRecordRepository'
import {
  create as createGapRecord,
  findAll as findAllGapRecords,
} from '../repositories/gapRecordRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import { generateBatchId } from '../utils/idGenerator'
import { detectGaps, findConflicts } from '../utils/recordMatcher'
import { createNewVersion } from './versionService'
import type { BillRecord, TeacherNote } from '../../../shared/types'

function importTeacherNotes(fileData: any[], operator: string): { batchId: string; count: number; records: TeacherNote[] } {
  const batchId = generateBatchId()

  const importTransaction = db.transaction(() => {
    const notesToCreate = fileData.map((item) => ({
      recordNo: item.recordNo || item.record_no || item.billNo || '',
      date: item.date || '',
      teacherName: item.teacherName || item.teacher_name || item.teacher || '',
      amount: Number(item.amount) || 0,
      itemType: item.itemType || item.item_type || item.type || '',
      annotation: item.annotation || item.remark || item.note || '',
      importBatchId: batchId,
      importedBy: operator,
    }))

    const records = batchCreateTeacherNote(notesToCreate)

    for (const note of records) {
      const existingRecord = findBillRecordByRecordNo(note.recordNo)
      if (!existingRecord) {
        createBillRecord({
          recordNo: note.recordNo,
          date: note.date,
          teacherName: note.teacherName,
          amount: note.amount,
          itemType: note.itemType,
          status: 'pending',
          teacherNoteId: note.id,
        })
      } else {
        updateBillRecord(existingRecord.id, {
          teacherNoteId: note.id,
        })
      }
    }

    createOperationHistory({
      operationType: 'import',
      description: `导入老师批注数据 ${records.length} 条`,
      operator,
      operatorRole: 'admin',
    })

    return records
  })

  const records = importTransaction()

  createNewVersion(operator, 'admin', `导入老师批注 ${records.length} 条`)

  return {
    batchId,
    count: records.length,
    records,
  }
}

function importSamplingList(fileData: any[], operator: string): { batchId: string; count: number; records: BillRecord[] } {
  const batchId = generateBatchId()
  const createdRecords: BillRecord[] = []

  const importTransaction = db.transaction(() => {
    const listsToCreate = fileData.map((item) => ({
      recordNo: item.recordNo || item.record_no || item.billNo || '',
      date: item.date || '',
      teacherName: item.teacherName || item.teacher_name || item.teacher || '',
      amount: Number(item.amount) || 0,
      itemType: item.itemType || item.item_type || item.type || '',
      sceneDescription: item.sceneDescription || item.scene_description || item.description || '',
      isOldFormat: Boolean(item.isOldFormat || item.is_old_format || false),
      importBatchId: batchId,
      importedBy: operator,
    }))

    const samplingRecords = batchCreateSamplingList(listsToCreate)

    for (const sampling of samplingRecords) {
      const teacherNote = findTeacherNoteByRecordNo(sampling.recordNo)
      const existingRecord = findBillRecordByRecordNo(sampling.recordNo)

      let status: BillRecord['status'] = 'pending'
      let teacherNoteId = teacherNote?.id
      let nextHandler = '无'
      let reason = ''

      if (sampling.isOldFormat && !teacherNote) {
        status = 'supplement'
        nextHandler = '唐老师'
        reason = '旧口径补录，仅抽样名单中有，老师批注中无此记录'
      } else if (teacherNote) {
        const conflicts = findConflicts(teacherNote, sampling)
        if (conflicts.length > 0) {
          status = 'conflict'
          nextHandler = '唐老师'
          reason = '老师批注与抽样名单字段不一致，需人工确认'
        } else {
          status = 'smooth'
          nextHandler = '无'
          reason = '双边数据完全一致，顺利通过'
        }
      } else {
        status = 'pending'
        nextHandler = '待导入老师批注'
        reason = '仅抽样名单存在，等待老师批注数据导入后匹配'
      }

      let billRecord: BillRecord
      if (!existingRecord) {
        billRecord = createBillRecord({
          recordNo: sampling.recordNo,
          date: sampling.date,
          teacherName: sampling.teacherName,
          amount: sampling.amount,
          itemType: sampling.itemType,
          status,
          teacherNoteId,
          samplingListId: sampling.id,
        })
      } else {
        billRecord = updateBillRecord(existingRecord.id, {
          status,
          teacherNoteId,
          samplingListId: sampling.id,
        }) as BillRecord
      }

      if (status === 'conflict' && teacherNote) {
        const conflicts = findConflicts(teacherNote, sampling)
        createConflictRecord({
          recordId: billRecord.id,
          teacherNoteId: teacherNote.id,
          samplingListId: sampling.id,
          conflictingFields: conflicts,
        })
      }

      createdRecords.push(billRecord)

      createOperationHistory({
        operationType: 'match',
        description: `匹配记录 ${sampling.recordNo} 状态为 ${status}${status === 'conflict' ? '（存在字段冲突）' : ''}`,
        recordId: billRecord.id,
        operator,
        operatorRole: 'admin',
        beforeState: {
          status: existingRecord?.status || 'pending',
          recordNo: sampling.recordNo,
          teacherName: sampling.teacherName,
          amount: sampling.amount,
          rawTeacherNote: teacherNote?.annotation || '',
          rawSampling: sampling.sceneDescription || '',
        },
        afterState: {
          status,
          recordNo: sampling.recordNo,
          teacherName: sampling.teacherName,
          amount: sampling.amount,
          rawTeacherNote: teacherNote?.annotation || '',
          rawSampling: sampling.sceneDescription || '',
          nextHandler,
          reason,
        },
        nextHandler,
        reason,
      })
    }

    const allNotes = findAllTeacherNotes()
    const allNoteNos = allNotes.map((n) => n.recordNo).sort()
    const gaps = detectGaps(allNoteNos)

    for (const gap of gaps) {
      const nextRecord = findBillRecordByRecordNo(gap.nextNo)
      if (nextRecord && nextRecord.status !== 'gap') {
        const teacherNote = nextRecord.teacherNoteId
          ? findTeacherNoteById(nextRecord.teacherNoteId)
          : undefined
        const samplingListRecord = nextRecord.samplingListId
          ? findSamplingListById(nextRecord.samplingListId)
          : undefined

        const gapReason = `编号断档：${gap.prevNo} 之后跳过 ${gap.missingNo} 直接到 ${gap.nextNo}，疑似人工删除一行`
        const gapNextHandler = '教研组'

        updateBillRecord(nextRecord.id, {
          status: 'gap',
        })

        createOperationHistory({
          operationType: 'match',
          description: `检测到断档：缺失记录 ${gap.missingNo}`,
          recordId: nextRecord.id,
          operator,
          operatorRole: 'admin',
          beforeState: {
            status: nextRecord.status,
            recordNo: nextRecord.recordNo,
            teacherName: nextRecord.teacherName,
            amount: nextRecord.amount,
            rawTeacherNote: teacherNote?.annotation || '',
            rawSampling: samplingListRecord?.sceneDescription || '',
          },
          afterState: {
            status: 'gap',
            recordNo: nextRecord.recordNo,
            missingRecordNo: gap.missingNo,
            previousNo: gap.prevNo,
            nextNo: gap.nextNo,
            nextHandler: gapNextHandler,
            reason: gapReason,
          },
          nextHandler: gapNextHandler,
          reason: gapReason,
        })
      }

      const existingGap = findAllGapRecords().find(
        (g) => g.missingRecordNo === gap.missingNo
      )

      if (!existingGap && nextRecord) {
        createGapRecord({
          recordId: nextRecord.id,
          missingRecordNo: gap.missingNo,
          previousRecordNo: gap.prevNo,
          nextRecordNo: gap.nextNo,
        })
      }
    }

    createOperationHistory({
      operationType: 'import',
      description: `导入抽样名单数据 ${samplingRecords.length} 条`,
      operator,
      operatorRole: 'admin',
    })

    return createdRecords
  })

  const records = importTransaction()

  createNewVersion(operator, 'admin', `导入抽样名单 ${records.length} 条`)

  return {
    batchId,
    count: records.length,
    records,
  }
}

export { importTeacherNotes, importSamplingList }
