import { TradeRecord, RecordStatus, AuditLog, ReviewSource } from '../types';
import { ReversalDetector } from './ReversalDetector';

export class StatusFlowHandler {
  static moveToPendingReview(record: TradeRecord, operator: string, custodianPageRef?: string): TradeRecord {
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '提交复核',
      record.status,
      RecordStatus.PENDING_REVIEW,
      custodianPageRef ? `托管确认页参考: ${custodianPageRef}` : '风控值班人员提交复核'
    );

    const updatedRecord = {
      ...record,
      status: RecordStatus.PENDING_REVIEW,
      auditLogs: [...record.auditLogs, auditLog],
      updatedAt: new Date()
    };

    if (custodianPageRef && updatedRecord.tailDiffAdjustment) {
      updatedRecord.tailDiffAdjustment = {
        ...updatedRecord.tailDiffAdjustment,
        custodianPageReference: custodianPageRef,
        reviewSource: ReviewSource.CUSTODIAN_CONFIRMATION
      };
    }

    return updatedRecord;
  }

  static reviewAsNormal(record: TradeRecord, operator: string, remark?: string): TradeRecord {
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '复核通过-正常',
      record.status,
      RecordStatus.REVIEWED_NORMAL,
      remark || '风控同事复核确认正常'
    );

    return {
      ...record,
      status: RecordStatus.REVIEWED_NORMAL,
      auditLogs: [...record.auditLogs, auditLog],
      updatedAt: new Date()
    };
  }

  static reviewWithAdjustment(
    record: TradeRecord,
    operator: string,
    adjustedAmount: number,
    remark: string
  ): TradeRecord {
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '复核通过-调整',
      { status: record.status, amount: record.amount },
      { status: RecordStatus.REVIEWED_ADJUSTED, amount: adjustedAmount },
      remark
    );

    const updatedRecord = {
      ...record,
      amount: adjustedAmount,
      status: RecordStatus.REVIEWED_ADJUSTED,
      auditLogs: [...record.auditLogs, auditLog],
      updatedAt: new Date()
    };

    if (updatedRecord.tailDiffAdjustment) {
      updatedRecord.tailDiffAdjustment = {
        ...updatedRecord.tailDiffAdjustment,
        manualChange: adjustedAmount - record.originalAmount,
        currentStatus: RecordStatus.REVIEWED_ADJUSTED,
        reviewSource: ReviewSource.TAIL_DIFF_ADJUSTMENT
      };
    }

    return updatedRecord;
  }

  static markAsSummarized(record: TradeRecord, operator: string): TradeRecord {
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '纳入摘要',
      record.status,
      RecordStatus.SUMMARIZED,
      '已纳入给负责人的绩效摘要'
    );

    return {
      ...record,
      status: RecordStatus.SUMMARIZED,
      auditLogs: [...record.auditLogs, auditLog],
      updatedAt: new Date()
    };
  }

  static rollback(record: TradeRecord, operator: string, reason: string): TradeRecord {
    const previousStatus = this.getPreviousStatus(record.status);
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '状态回滚',
      record.status,
      previousStatus,
      reason
    );

    return {
      ...record,
      status: previousStatus,
      auditLogs: [...record.auditLogs, auditLog],
      updatedAt: new Date()
    };
  }

  private static getPreviousStatus(currentStatus: RecordStatus): RecordStatus {
    const statusFlow: Record<RecordStatus, RecordStatus> = {
      [RecordStatus.PENDING_IMPORT]: RecordStatus.PENDING_IMPORT,
      [RecordStatus.IMPORTED]: RecordStatus.PENDING_IMPORT,
      [RecordStatus.ZERO_WITH_REVERSAL]: RecordStatus.IMPORTED,
      [RecordStatus.PENDING_REVIEW]: RecordStatus.ZERO_WITH_REVERSAL,
      [RecordStatus.REVIEWED_NORMAL]: RecordStatus.PENDING_REVIEW,
      [RecordStatus.REVIEWED_ADJUSTED]: RecordStatus.PENDING_REVIEW,
      [RecordStatus.SUMMARIZED]: RecordStatus.REVIEWED_NORMAL
    };
    return statusFlow[currentStatus] || RecordStatus.PENDING_REVIEW;
  }
}
