import { v4 as uuidv4 } from 'uuid'
import { db } from './database'
import { checkBlockRules } from './blockRules'
import {
  MessageRecord,
  BatchInfo,
  ProcessingStatus,
  ProcessResult,
  TempTicket,
  Department,
  RiskType
} from './types'

export class MessageProcessor {
  async createTempTicket(params: {
    ticketNo: string
    applicant: string
    department: Department
    permissionType: string
    reason: string
    startTime: Date
    endTime: Date
    createdBy: string
  }): Promise<TempTicket> {
    const ticket: TempTicket = {
      id: uuidv4(),
      ...params,
      createdAt: new Date()
    }
    return db.saveTempTicket(ticket)
  }

  async createBatch(params: {
    batchNo: string
    name: string
    operator: string
    records: Array<{
      phone: string
      idCard: string
      userName: string
      content: string
      riskType: RiskType
      riskScore: number
      riskReason: string
    }>
    ticketId: string
  }): Promise<BatchInfo> {
    const batchId = uuidv4()
    const now = new Date()

    const messageRecords: MessageRecord[] = params.records.map(record => ({
      id: uuidv4(),
      batchId,
      ticketId: params.ticketId,
      ...record,
      status: ProcessingStatus.PENDING,
      operator: params.operator,
      createdAt: now,
      reviewRecords: []
    }))

    const batch: BatchInfo = {
      id: batchId,
      batchNo: params.batchNo,
      name: params.name,
      operator: params.operator,
      totalCount: messageRecords.length,
      successCount: 0,
      failedCount: 0,
      blockedCount: 0,
      status: ProcessingStatus.PENDING,
      createdAt: now
    }

    await db.saveBatch(batch)
    await db.saveMessageRecords(messageRecords)

    return batch
  }

  async previewBatch(batchId: string): Promise<ProcessResult> {
    const records = await db.findMessageRecordsByBatch(batchId)
    if (records.length === 0) {
      throw new Error('批次不存在或无记录')
    }

    const batch = await db.findBatchById(batchId)
    if (!batch) {
      throw new Error('批次不存在')
    }

    const ticket = await db.findTempTicketById(records[0].ticketId)
    if (!ticket) {
      throw new Error('临时票不存在')
    }

    let success = 0
    let blocked = 0
    let failed = 0

    const results = records.map(record => {
      const blockReason = checkBlockRules(record, ticket)
      if (blockReason) {
        blocked++
        return {
          recordId: record.id,
          userName: record.userName,
          phone: record.phone,
          status: ProcessingStatus.BLOCKED,
          reason: blockReason
        }
      }
      success++
      return {
        recordId: record.id,
        userName: record.userName,
        phone: record.phone,
        status: ProcessingStatus.SUCCESS,
        reason: '符合处理条件'
      }
    })

    return {
      batchId,
      total: records.length,
      success,
      failed,
      blocked,
      results
    }
  }

  async processBatch(batchId: string): Promise<ProcessResult> {
    const records = await db.findMessageRecordsByBatch(batchId)
    if (records.length === 0) {
      throw new Error('批次不存在或无记录')
    }

    const batch = await db.findBatchById(batchId)
    if (!batch) {
      throw new Error('批次不存在')
    }

    const ticket = await db.findTempTicketById(records[0].ticketId)
    if (!ticket) {
      throw new Error('临时票不存在')
    }

    let success = 0
    let blocked = 0
    let failed = 0
    const now = new Date()

    const results = await Promise.all(
      records.map(async record => {
        const blockReason = checkBlockRules(record, ticket)
        if (blockReason) {
          blocked++
          await db.updateMessageRecord(record.id, {
            status: ProcessingStatus.EARLY_TERMINATION_BLOCKED,
            blockReason,
            processedAt: now
          })
          return {
            recordId: record.id,
            userName: record.userName,
            phone: record.phone,
            status: ProcessingStatus.EARLY_TERMINATION_BLOCKED,
            reason: blockReason
          }
        }
        success++
        await db.updateMessageRecord(record.id, {
          status: ProcessingStatus.SUCCESS,
          processedAt: now
        })
        return {
          recordId: record.id,
          userName: record.userName,
          phone: record.phone,
          status: ProcessingStatus.SUCCESS,
          reason: '处理成功'
        }
      })
    )

    const batchStatus = blocked > 0 && success > 0
      ? ProcessingStatus.PARTIAL_SUCCESS
      : blocked > 0
        ? ProcessingStatus.BLOCKED
        : ProcessingStatus.SUCCESS

    await db.updateBatch(batchId, {
      successCount: success,
      blockedCount: blocked,
      failedCount: failed,
      status: batchStatus,
      completedAt: now
    })

    return {
      batchId,
      total: records.length,
      success,
      failed,
      blocked,
      results
    }
  }

  getEffectiveStatus(record: MessageRecord): ProcessingStatus {
    if (record.reviewRecords.length > 0) {
      const latestReview = record.reviewRecords[record.reviewRecords.length - 1]
      return latestReview.newConclusion
    }
    return record.status
  }

  async reviewMessage(params: {
    messageId: string
    reviewer: string
    reviewOpinion: string
    serviceTicketNo: string
    newConclusion: ProcessingStatus
  }) {
    const record = await db.findMessageRecordById(params.messageId)
    if (!record) {
      throw new Error('消息记录不存在')
    }

    const reviewRecord = {
      id: uuidv4(),
      messageId: params.messageId,
      reviewer: params.reviewer,
      reviewOpinion: params.reviewOpinion,
      serviceTicketNo: params.serviceTicketNo,
      originalConclusion: record.status,
      newConclusion: params.newConclusion,
      reviewedAt: new Date()
    }

    await db.saveReviewRecord(reviewRecord)
    await db.updateMessageRecord(params.messageId, {
      reviewRecords: [...record.reviewRecords, reviewRecord]
    })

    return reviewRecord
  }

  async queryRecords(filters?: {
    batchId?: string
    operator?: string
    riskType?: RiskType
    status?: ProcessingStatus
  }) {
    let records = await db.findAllMessageRecords()

    if (filters) {
      if (filters.batchId) {
        records = records.filter(r => r.batchId === filters.batchId)
      }
      if (filters.operator) {
        records = records.filter(r => r.operator === filters.operator)
      }
      if (filters.riskType) {
        records = records.filter(r => r.riskType === filters.riskType)
      }
      if (filters.status) {
        records = records.filter(r => this.getEffectiveStatus(r) === filters.status)
      }
    }

    return records
  }

  async queryBatches() {
    return db.findAllBatches()
  }

  async getRecordDetail(recordId: string) {
    const record = await db.findMessageRecordById(recordId)
    if (!record) {
      return null
    }
    const reviews = await db.findReviewRecordsByMessage(recordId)
    return { record, reviews }
  }
}

export const processor = new MessageProcessor()