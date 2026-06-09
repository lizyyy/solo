import { db } from '../db'
import * as conflictRecordRepo from '../repositories/conflictRecordRepository'
import * as billRecordRepo from '../repositories/billRecordRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import type { ConflictRecord, ParamVersion, ConflictResolution } from '../../../shared/types'
import { createNewVersion } from './versionService'

function getConflicts(): ConflictRecord[] {
  return conflictRecordRepo.findAll()
}

function resolveConflict(
  id: string,
  resolution: ConflictResolution,
  note: string,
  operator: string
): { conflict: ConflictRecord; newVersion: ParamVersion } {
  const conflict = conflictRecordRepo.findById(id)
  if (!conflict) {
    throw new Error(`冲突记录 ${id} 不存在`)
  }

  if (conflict.resolution) {
    throw new Error(`冲突记录 ${id} 已处理，无法重复处理`)
  }

  const resolveTransaction = db.transaction(() => {
    const resolvedConflict = conflictRecordRepo.resolve(id, {
      resolution,
      note,
      resolvedBy: operator,
    })

    const record = billRecordRepo.findById(conflict.recordId)
    if (!record) {
      throw new Error(`关联记录 ${conflict.recordId} 不存在`)
    }

    let afterStatus: typeof record.status = 'approved'

    if (resolution === 'rejected') {
      afterStatus = 'rejected'
    }

    const conflictNextHandler = '归档'
    const conflictReason = note || `冲突处理结果：${resolution === 'teacher_note' ? '以老师批注为准' : resolution === 'sampling_list' ? '以抽样名单为准' : '驳回，需重新处理'}`

    billRecordRepo.update(record.id, {
      status: afterStatus,
    })

    createOperationHistory({
      operationType: 'conflict_resolve',
      description: `处理冲突记录 ${record.recordNo}，处理方式: ${resolution}，备注: ${note}`,
      recordId: record.id,
      operator,
      operatorRole: 'coach',
      beforeState: {
        status: record.status,
        recordNo: record.recordNo,
        teacherName: record.teacherName,
        amount: record.amount,
        conflictingFields: conflict.conflictingFields,
        resolution: 'none',
      },
      afterState: {
        status: afterStatus,
        recordNo: record.recordNo,
        teacherName: record.teacherName,
        amount: record.amount,
        conflictingFields: conflict.conflictingFields,
        resolution,
        resolutionNote: note,
        nextHandler: conflictNextHandler,
        reason: conflictReason,
      },
      nextHandler: conflictNextHandler,
      reason: conflictReason,
    })

    return resolvedConflict
  })

  const resolvedConflict = resolveTransaction()

  const newVersion = createNewVersion(
    operator,
    'coach',
    `处理冲突记录 ${id}，处理方式: ${resolution}`
  )

  return {
    conflict: resolvedConflict,
    newVersion,
  }
}

export { getConflicts, resolveConflict }
