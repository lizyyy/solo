import { db } from '../db'
import * as gapRecordRepo from '../repositories/gapRecordRepository'
import * as billRecordRepo from '../repositories/billRecordRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import type { GapRecord, ParamVersion, GapReviewStatus } from '../../../shared/types'
import { createNewVersion } from './versionService'

function getGaps(): GapRecord[] {
  return gapRecordRepo.findAll()
}

function reviewGap(
  id: string,
  status: GapReviewStatus,
  note: string,
  operator: string
): { gap: GapRecord; newVersion: ParamVersion } {
  const gap = gapRecordRepo.findById(id)
  if (!gap) {
    throw new Error(`断档记录 ${id} 不存在`)
  }

  if (gap.reviewStatus !== 'pending') {
    throw new Error(`断档记录 ${id} 已复核，无法重复处理`)
  }

  const reviewTransaction = db.transaction(() => {
    const reviewedGap = gapRecordRepo.review(id, {
      status: status as 'normal' | 'abnormal',
      note,
      reviewedBy: operator,
    })

    const record = billRecordRepo.findById(gap.recordId)
    if (!record) {
      throw new Error(`关联记录 ${gap.recordId} 不存在`)
    }

    const beforeState = record.status
    const afterState: typeof record.status = status === 'normal'
      ? 'reviewed_normal'
      : 'reviewed_abnormal'

    billRecordRepo.update(record.id, {
      status: afterState,
    })

    createOperationHistory({
      operationType: 'gap_review',
      description: `复核断档记录 ${gap.missingRecordNo}，结果: ${status === 'normal' ? '正常' : '异常'}，备注: ${note}`,
      recordId: record.id,
      operator,
      operatorRole: 'reviewer',
      beforeState,
      afterState,
    })

    return reviewedGap
  })

  const reviewedGap = reviewTransaction()

  const newVersion = createNewVersion(
    operator,
    `复核断档记录 ${gap.missingRecordNo}，结果: ${status === 'normal' ? '正常' : '异常'}`
  )

  return {
    gap: reviewedGap,
    newVersion,
  }
}

export { getGaps, reviewGap }
