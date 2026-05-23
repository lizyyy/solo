import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationRecord,
  ReconciliationStatus,
  AuditLog,
} from '../types';
import dataStore from '../store/dataStore';

export type ReviewAction = 'approve' | 'reject' | 'supplement' | 'mark_as_reviewing';

export class ReviewService {
  performAction(
    recordId: string,
    action: ReviewAction,
    operator: string,
    remark?: string
  ): ReconciliationRecord {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`对账记录不存在: ${recordId}`);
    }

    const oldStatus = record.status;
    const newStatus = this.getNewStatus(action);

    const auditLog: AuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      operator,
      action: this.getActionDescription(action),
      oldValue: oldStatus,
      newValue: newStatus,
      remark,
    };

    record.status = newStatus;
    record.reviewer = operator;
    record.reviewRemark = remark;
    record.reviewedAt = new Date();
    record.auditLogs.push(auditLog);

    dataStore.saveReconciliationRecord(record);
    dataStore.updateBatchStats(record.batchId);

    return record;
  }

  private getNewStatus(action: ReviewAction): ReconciliationStatus {
    switch (action) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'supplement':
        return 'supplement';
      case 'mark_as_reviewing':
        return 'reviewing';
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }

  private getActionDescription(action: ReviewAction): string {
    switch (action) {
      case 'approve':
        return '审批通过';
      case 'reject':
        return '退回';
      case 'supplement':
        return '要求补材料';
      case 'mark_as_reviewing':
        return '标记为复核中';
      default:
        return action;
    }
  }

  approve(recordId: string, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(recordId, 'approve', operator, remark);
  }

  reject(recordId: string, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(recordId, 'reject', operator, remark);
  }

  requestSupplement(recordId: string, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(recordId, 'supplement', operator, remark);
  }

  markAsReviewing(recordId: string, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(recordId, 'mark_as_reviewing', operator, remark);
  }

  batchApprove(
    recordIds: string[],
    operator: string,
    remark?: string
  ): { success: string[]; failed: string[] } {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of recordIds) {
      try {
        this.approve(id, operator, remark);
        success.push(id);
      } catch (e: any) {
        failed.push(id);
      }
    }

    return { success, failed };
  }

  addComment(
    recordId: string,
    operator: string,
    comment: string
  ): ReconciliationRecord {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`对账记录不存在: ${recordId}`);
    }

    record.auditLogs.push({
      id: uuidv4(),
      timestamp: new Date(),
      operator,
      action: '添加备注',
      remark: comment,
    });

    dataStore.saveReconciliationRecord(record);
    return record;
  }

  resolveDiscrepancy(
    recordId: string,
    discrepancyId: string,
    operator: string,
    resolution: string
  ): ReconciliationRecord {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`对账记录不存在: ${recordId}`);
    }

    const discrepancy = record.discrepancies.find(d => d.id === discrepancyId);
    if (!discrepancy) {
      throw new Error(`差异不存在: ${discrepancyId}`);
    }

    record.auditLogs.push({
      id: uuidv4(),
      timestamp: new Date(),
      operator,
      action: '处理差异',
      oldValue: discrepancy.description,
      newValue: resolution,
      remark: `差异ID: ${discrepancyId}`,
    });

    dataStore.saveReconciliationRecord(record);
    return record;
  }

  getRecordAuditTrail(recordId: string): AuditLog[] {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`对账记录不存在: ${recordId}`);
    }
    return [...record.auditLogs].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  explainDecision(recordId: string): string {
    const record = dataStore.getReconciliationRecord(recordId);
    if (!record) {
      throw new Error(`对账记录不存在: ${recordId}`);
    }

    const parts: string[] = [];

    parts.push(`【服务单 ${record.serviceOrder.orderNo}】处理说明`);
    parts.push(`老人: ${record.serviceOrder.elderName}`);
    parts.push(`护士: ${record.serviceOrder.nurseName}`);
    parts.push(`服务日期: ${record.serviceOrder.serviceDate}`);
    parts.push(``);
    parts.push(`当前状态: ${this.getStatusText(record.status)}`);

    if (record.discrepancies.length > 0) {
      parts.push(``);
      parts.push(`发现的差异 (${record.discrepancies.length} 处):`);
      record.discrepancies.forEach((d, i) => {
        parts.push(`${i + 1}. ${d.description}`);
        parts.push(`   说明: ${d.explanation}`);
      });
    }

    if (record.reviewRemark) {
      parts.push(``);
      parts.push(`复核意见: ${record.reviewRemark}`);
    }

    if (record.reviewer && record.reviewedAt) {
      parts.push(``);
      parts.push(`复核人: ${record.reviewer}`);
      parts.push(`复核时间: ${record.reviewedAt.toLocaleString()}`);
    }

    return parts.join('\n');
  }

  private getStatusText(status: ReconciliationStatus): string {
    const map: Record<ReconciliationStatus, string> = {
      matched: '已匹配',
      discrepancy: '存在差异',
      reviewing: '复核中',
      approved: '已放行',
      rejected: '已退回',
      supplement: '待补材料',
    };
    return map[status] || status;
  }
}

export default new ReviewService();
