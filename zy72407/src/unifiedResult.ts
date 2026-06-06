import {
  ConsumptionRecord,
  UnifiedResult,
  RecordStatus,
  ReviewFlag,
  ImportBatch
} from './types'
import { runSelfCheck } from './selfCheck'

export class UnifiedResultStore {
  private records: ConsumptionRecord[] = []
  private batches: ImportBatch[] = []

  setRecords(records: ConsumptionRecord[]): void {
    this.records = JSON.parse(JSON.stringify(records))
  }

  getRecords(): ConsumptionRecord[] {
    return JSON.parse(JSON.stringify(this.records))
  }

  setBatches(batches: ImportBatch[]): void {
    this.batches = JSON.parse(JSON.stringify(batches))
  }

  getBatches(): ImportBatch[] {
    return JSON.parse(JSON.stringify(this.batches))
  }

  addBatch(batch: ImportBatch): void {
    this.batches.push(JSON.parse(JSON.stringify(batch)))
  }

  updateRecord(id: string, updates: Partial<ConsumptionRecord>): void {
    const index = this.records.findIndex(r => r.id === id)
    if (index !== -1) {
      this.records[index] = {
        ...this.records[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
    }
  }

  generateUnifiedResult(): UnifiedResult {
    const records = this.getRecords()
    const selfCheck = runSelfCheck(records, this.batches)
    
    const byStatus: Record<RecordStatus, number> = {} as Record<RecordStatus, number>
    const byReviewFlag: Record<ReviewFlag, number> = {} as Record<ReviewFlag, number>
    
    Object.values(RecordStatus).forEach(status => {
      byStatus[status] = 0
    })
    Object.values(ReviewFlag).forEach(flag => {
      byReviewFlag[flag] = 0
    })

    let totalDurationMinutes = 0
    let totalSettlementAmount = 0

    records.forEach(record => {
      byStatus[record.status] = (byStatus[record.status] || 0) + 1
      byReviewFlag[record.reviewFlag] = (byReviewFlag[record.reviewFlag] || 0) + 1
      totalDurationMinutes += record.durationMinutes || 0
      totalSettlementAmount += record.settlementAmount || 0
    })

    return {
      records,
      summary: {
        total: records.length,
        byStatus,
        byReviewFlag,
        totalDurationMinutes,
        totalSettlementAmount
      },
      selfCheck,
      generatedAt: new Date().toISOString(),
      batchIds: this.batches.map(b => b.id)
    }
  }

  getForPageDisplay(): UnifiedResult {
    return this.generateUnifiedResult()
  }

  getForExport(): any[] {
    const result = this.generateUnifiedResult()
    return result.records.map(record => ({
      id: record.id,
      studentName: record.studentName,
      courseDate: record.courseDate,
      courseTime: record.courseTime,
      teacherName: record.teacherName,
      courseType: record.courseType,
      durationMinutes: record.durationMinutes,
      isOnSite: record.isOnSite,
      status: record.status,
      reviewFlag: record.reviewFlag,
      settlementAmount: record.settlementAmount,
      tunerOriginalLineNumber: record.tunerOriginalLineNumber,
      tunerRawContent: record.tunerRawContent,
      groupOriginalLineNumber: record.groupOriginalLineNumber,
      groupRawContent: record.groupRawContent,
      manualEdits: record.manualEdits.length,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }))
  }

  getForApiResponse(): UnifiedResult {
    return this.generateUnifiedResult()
  }

  getRecordEvidence(recordId: string): any {
    const record = this.records.find(r => r.id === recordId)
    if (!record) return null

    return {
      record,
      evidence: {
        tunerMessage: record.tunerMessageId ? {
          id: record.tunerMessageId,
          originalLineNumber: record.tunerOriginalLineNumber,
          rawContent: record.tunerRawContent
        } : null,
        groupSignup: record.groupSignupId ? {
          id: record.groupSignupId,
          originalLineNumber: record.groupOriginalLineNumber,
          rawContent: record.groupRawContent
        } : null,
        manualEdits: record.manualEdits
      }
    }
  }
}

export const unifiedStore = new UnifiedResultStore()
