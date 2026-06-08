import { TradeRecord, RecordStatus, AuditLog, ReviewSource, TransitionResult, ALLOWED_TRANSITIONS } from '../types';
import { ReversalDetector } from './ReversalDetector';

export class StatusFlowHandler {
  static validateTransition(currentStatus: RecordStatus, targetStatus: RecordStatus): TransitionResult {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const statusLabels: Record<RecordStatus, string> = {
        [RecordStatus.PENDING_IMPORT]: '待导入',
        [RecordStatus.IMPORTED]: '已导入',
        [RecordStatus.ZERO_WITH_REVERSAL]: '金额为0-待冲正复核',
        [RecordStatus.PENDING_REVIEW]: '待风控复核',
        [RecordStatus.REVIEWED_NORMAL]: '复核通过-正常',
        [RecordStatus.REVIEWED_ADJUSTED]: '复核通过-已调整',
        [RecordStatus.SUMMARIZED]: '已纳入摘要'
      };
      return {
        success: false,
        error: `状态流转不合法: 当前状态[${statusLabels[currentStatus]}]不允许直接变为[${statusLabels[targetStatus]}]。允许的目标状态: ${allowed.map(s => statusLabels[s]).join('、') || '无（终态）'}`
      };
    }
    return { success: true };
  }

  static moveToPendingReview(record: TradeRecord, operator: string, custodianPageRef?: string): TransitionResult & { record?: TradeRecord } {
    const validation = this.validateTransition(record.status, RecordStatus.PENDING_REVIEW);
    if (!validation.success) return validation;

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

    return { success: true, record: updatedRecord };
  }

  static reviewAsNormal(record: TradeRecord, operator: string, remark?: string): TransitionResult & { record?: TradeRecord } {
    const validation = this.validateTransition(record.status, RecordStatus.REVIEWED_NORMAL);
    if (!validation.success) return validation;

    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '复核通过-正常',
      record.status,
      RecordStatus.REVIEWED_NORMAL,
      remark || '风控同事复核确认正常'
    );

    return {
      success: true,
      record: {
        ...record,
        status: RecordStatus.REVIEWED_NORMAL,
        auditLogs: [...record.auditLogs, auditLog],
        updatedAt: new Date()
      }
    };
  }

  static reviewWithAdjustment(
    record: TradeRecord,
    operator: string,
    adjustedAmount: number,
    remark: string
  ): TransitionResult & { record?: TradeRecord } {
    const validation = this.validateTransition(record.status, RecordStatus.REVIEWED_ADJUSTED);
    if (!validation.success) return validation;

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

    return { success: true, record: updatedRecord };
  }

  static markAsSummarized(record: TradeRecord, operator: string): TransitionResult & { record?: TradeRecord } {
    const validation = this.validateTransition(record.status, RecordStatus.SUMMARIZED);
    if (!validation.success) return validation;

    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '纳入摘要',
      record.status,
      RecordStatus.SUMMARIZED,
      '已纳入给负责人的绩效摘要'
    );

    return {
      success: true,
      record: {
        ...record,
        status: RecordStatus.SUMMARIZED,
        auditLogs: [...record.auditLogs, auditLog],
        updatedAt: new Date()
      }
    };
  }

  static rollback(record: TradeRecord, operator: string, reason: string): TransitionResult & { record?: TradeRecord } {
    if (record.status === RecordStatus.PENDING_IMPORT) {
      return { success: false, error: '待导入状态无法回滚' };
    }

    const previousStatus = this.getPreviousStatus(record.status);
    const auditLog = ReversalDetector.createAuditLog(
      operator,
      '状态回滚',
      record.status,
      previousStatus,
      reason
    );

    return {
      success: true,
      record: {
        ...record,
        status: previousStatus,
        auditLogs: [...record.auditLogs, auditLog],
        updatedAt: new Date()
      }
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
