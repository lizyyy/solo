import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationRecord,
  ReconciliationBatch,
  ReviewStatus,
  ReviewAction,
  AuditLogEntry,
  Discrepancy,
  DiscrepancyType,
  DataSource,
} from '../types';

export class ReviewService {
  private createAuditLog(
    reconciliationId: string,
    action: string,
    operator: string,
    previousValue?: any,
    newValue?: any,
    reason?: string
  ): AuditLogEntry {
    return {
      id: uuidv4(),
      reconciliationId,
      action,
      previousValue,
      newValue,
      operator,
      timestamp: new Date(),
      reason,
    };
  }

  private createManualDiscrepancy(
    description: string,
    recordId: string,
    fieldName: string,
    oldValue: string,
    newValue: string
  ): Discrepancy {
    return {
      id: uuidv4(),
      type: DiscrepancyType.MANUAL_CHANGE,
      description,
      severity: 'medium',
      relatedRecordIds: [recordId],
      sourceEvidence: [
        {
          source: DataSource.MANUAL,
          field: fieldName,
          expectedValue: oldValue,
          actualValue: newValue,
        },
      ],
    };
  }

  public processReviewAction(
    record: ReconciliationRecord,
    action: ReviewAction
  ): ReconciliationRecord {
    const auditLogs: AuditLogEntry[] = [...record.auditTrail];
    const updatedRecord = { ...record };
    let discrepancies = [...record.discrepancies];

    auditLogs.push(
      this.createAuditLog(
        record.id,
        `review_${action.action}`,
        action.operator,
        record.reviewStatus,
        action.action,
        action.reason
      )
    );

    switch (action.action) {
      case 'approve':
        updatedRecord.reviewStatus = ReviewStatus.APPROVED;
        updatedRecord.finalStatus = 'allowed';
        updatedRecord.finalReason = action.reason || '审核通过，数据一致';
        break;
      case 'reject':
        updatedRecord.reviewStatus = ReviewStatus.REJECTED;
        updatedRecord.finalStatus = 'rejected';
        updatedRecord.finalReason = action.reason || '审核拒绝，数据存在问题';
        break;
      case 'request_info':
        updatedRecord.reviewStatus = ReviewStatus.NEEDS_MORE_INFO;
        updatedRecord.finalStatus = 'pending';
        updatedRecord.finalReason = action.reason || '需要补充材料';
        break;
    }

    if (action.updateFields) {
      for (const [field, value] of Object.entries(action.updateFields)) {
        const oldValue = (record as any)[field];
        if (oldValue !== value) {
          auditLogs.push(
            this.createAuditLog(
              record.id,
              `field_update`,
              action.operator,
              oldValue,
              value,
              `手动更新字段: ${field}`
            )
          );

          const fieldLabels: Record<string, string> = {
            name: '姓名',
            phone: '电话',
            checkInStatus: '签到状态',
            registrationStatus: '报名状态',
            activityName: '活动名称',
          };

          discrepancies.push(
            this.createManualDiscrepancy(
              `手动修改${fieldLabels[field] || field}：从 "${oldValue}" 改为 "${value}"`,
              record.id,
              field,
              String(oldValue),
              String(value)
            )
          );

          (updatedRecord as any)[field] = value;
        }
      }
    }

    updatedRecord.discrepancies = discrepancies;
    updatedRecord.auditTrail = auditLogs;
    updatedRecord.updatedAt = new Date();

    return updatedRecord;
  }

  public batchReview(
    records: ReconciliationRecord[],
    recordIds: string[],
    action: Omit<ReviewAction, 'recordId'>
  ): ReconciliationRecord[] {
    return records.map((record) => {
      if (recordIds.includes(record.id)) {
        return this.processReviewAction(record, { ...action, recordId: record.id });
      }
      return record;
    });
  }

  public getAuditTrail(record: ReconciliationRecord): AuditLogEntry[] {
    return record.auditTrail.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public explainFinalStatus(record: ReconciliationRecord): {
    status: string;
    reason: string;
    evidence: string[];
  } {
    const statusMap: Record<string, string> = {
      allowed: '放行',
      rejected: '退回',
      pending: '待处理',
    };

    const evidence: string[] = [];

    record.discrepancies.forEach((d) => {
      const typeLabels: Record<string, string> = {
        [DiscrepancyType.DUPLICATE_REGISTRATION]: '重复报名',
        [DiscrepancyType.BLACKLISTED]: '黑名单人员',
        [DiscrepancyType.WAITLIST_PROMOTED]: '候补递补',
        [DiscrepancyType.CANCELLED_BUT_CHECKED_IN]: '取消后签到',
        [DiscrepancyType.NOT_REGISTERED_BUT_CHECKED_IN]: '无报名但签到',
        [DiscrepancyType.REGISTERED_BUT_NOT_CHECKED_IN]: '报名未签到',
        [DiscrepancyType.INFO_MISMATCH]: '信息不一致',
        [DiscrepancyType.MANUAL_CHANGE]: '人工修改',
      };

      const sources = d.sourceEvidence
        .map((e) => {
          const sourceLabels: Record<string, string> = {
            [DataSource.REGISTRATION_CSV]: '报名表',
            [DataSource.WAITLIST_JSON]: '候补表',
            [DataSource.CHECKIN_CSV]: '签到表',
            [DataSource.BLACKLIST_JSON]: '黑名单',
            [DataSource.MANUAL]: '人工操作',
          };
          return sourceLabels[e.source] || e.source;
        })
        .join('、');

      evidence.push(`[${typeLabels[d.type]}] ${d.description} (来源: ${sources})`);
    });

    const reviewLog = record.auditTrail.filter((log) => log.action.startsWith('review_'));
    if (reviewLog.length > 0) {
      const lastReview = reviewLog[reviewLog.length - 1];
      evidence.push(`[审核记录] 操作员"${lastReview.operator}"于${lastReview.timestamp.toLocaleString()}处理：${lastReview.reason}`);
    }

    return {
      status: statusMap[record.finalStatus] || record.finalStatus,
      reason: record.finalReason || '未设置原因',
      evidence,
    };
  }

  public traceCheckInSource(
    record: ReconciliationRecord
  ): {
    hasCheckIn: boolean;
    checkInTime?: Date;
    checkInSource: string;
    relatedRecords: {
      type: string;
      id: string;
      status: string;
    }[];
  } {
    const relatedRecords: { type: string; id: string; status: string }[] = [];

    if (record.registrationId) {
      relatedRecords.push({
        type: '报名记录',
        id: record.registrationId,
        status: record.registrationStatus || '未知',
      });
    }

    if (record.waitlistId) {
      relatedRecords.push({
        type: '候补记录',
        id: record.waitlistId,
        status: '候补',
      });
    }

    if (record.checkInId) {
      relatedRecords.push({
        type: '签到记录',
        id: record.checkInId,
        status: record.checkInStatus,
      });
    }

    return {
      hasCheckIn: record.checkInId !== undefined,
      checkInTime: record.checkInId ? record.updatedAt : undefined,
      checkInSource: record.checkInId ? '签到表导入' : '无签到记录',
      relatedRecords,
    };
  }
}
