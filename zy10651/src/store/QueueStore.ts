import { v4 as uuidv4 } from 'uuid';
import {
  QueueRecord,
  StatusHistory,
  QueueStatus,
  RecordStatus,
  CreateQueueRequest,
  QueryFilter,
  PaginatedResult,
  ExportRecord
} from '../types';

class QueueStore {
  private queueRecords: Map<string, QueueRecord> = new Map();
  private statusHistories: Map<string, StatusHistory> = new Map();

  createQueueRecord(request: CreateQueueRequest): QueueRecord {
    const now = new Date();
    const recordId = uuidv4();

    const record: QueueRecord = {
      id: recordId,
      visitor: request.visitor,
      skillGroupId: request.skillGroupId,
      skillGroupName: request.skillGroupName,
      overflowTargetId: request.overflowTargetId,
      overflowTargetName: request.overflowTargetName,
      status: QueueStatus.QUEUING,
      recordStatus: RecordStatus.SUCCESS,
      queueStartTime: now,
      queueDurationSeconds: 0,
      businessObject: request.businessObject,
      createdAt: now,
      updatedAt: now
    };

    this.queueRecords.set(recordId, record);

    this.addStatusHistory({
      queueRecordId: recordId,
      previousStatus: null,
      newStatus: QueueStatus.QUEUING,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      reason: '创建排队记录'
    });

    return record;
  }

  getQueueRecord(id: string): QueueRecord | undefined {
    return this.queueRecords.get(id);
  }

  updateQueueRecordStatus(
    id: string,
    status: QueueStatus,
    operatorId?: string,
    operatorName?: string,
    reason?: string
  ): QueueRecord | null {
    const record = this.queueRecords.get(id);
    if (!record) {
      return null;
    }

    const previousStatus = record.status;

    if (previousStatus === QueueStatus.ABANDONED || previousStatus === QueueStatus.CONNECTED) {
      return null;
    }

    this.addStatusHistory({
      queueRecordId: id,
      previousStatus,
      newStatus: status,
      operatorId,
      operatorName,
      reason
    });

    record.status = status;
    record.updatedAt = new Date();

    if (status === QueueStatus.CONNECTED) {
      record.connectedTime = new Date();
    } else if (status === QueueStatus.ABANDONED) {
      record.abandonedTime = new Date();
    }

    this.updateQueueDuration(record);
    this.queueRecords.set(id, record);

    return record;
  }

  updateRecordStatus(id: string, recordStatus: RecordStatus): QueueRecord | null {
    const record = this.queueRecords.get(id);
    if (!record) {
      return null;
    }

    record.recordStatus = recordStatus;
    record.updatedAt = new Date();
    this.queueRecords.set(id, record);

    return record;
  }

  createOverflowPlaceholder(originalRecord: QueueRecord, operatorId?: string, operatorName?: string): QueueRecord {
    const now = new Date();
    const placeholderId = uuidv4();

    const placeholder: QueueRecord = {
      id: placeholderId,
      visitor: originalRecord.visitor,
      skillGroupId: originalRecord.overflowTargetId || originalRecord.skillGroupId,
      skillGroupName: originalRecord.overflowTargetName || originalRecord.skillGroupName,
      overflowTargetId: originalRecord.overflowTargetId,
      overflowTargetName: originalRecord.overflowTargetName,
      status: QueueStatus.OVERFLOWING,
      recordStatus: RecordStatus.SUCCESS,
      queueStartTime: now,
      queueDurationSeconds: 0,
      businessObject: originalRecord.businessObject,
      ownerId: originalRecord.ownerId,
      ownerName: originalRecord.ownerName,
      createdAt: now,
      updatedAt: now,
      isOverflowPlaceholder: true
    };

    this.queueRecords.set(placeholderId, placeholder);

    this.addStatusHistory({
      queueRecordId: placeholderId,
      previousStatus: null,
      newStatus: QueueStatus.OVERFLOWING,
      operatorId,
      operatorName,
      reason: '溢出到目标技能组，创建占位记录'
    });

    return placeholder;
  }

  withdrawQueueRecord(id: string, operatorId?: string, operatorName?: string): QueueRecord | null {
    const record = this.queueRecords.get(id);
    if (!record) {
      return null;
    }

    return this.updateQueueRecordStatus(
      id,
      QueueStatus.ABANDONED,
      operatorId,
      operatorName,
      '用户撤回排队'
    );
  }

  resubmitQueueRecord(id: string, operatorId?: string, operatorName?: string): QueueRecord | null {
    const record = this.queueRecords.get(id);
    if (!record) {
      return null;
    }

    if (record.status !== QueueStatus.ABANDONED) {
      return null;
    }

    const now = new Date();
    record.status = QueueStatus.QUEUING;
    record.queueStartTime = now;
    record.queueDurationSeconds = 0;
    record.abandonedTime = undefined;
    record.updatedAt = now;

    this.queueRecords.set(id, record);

    this.addStatusHistory({
      queueRecordId: id,
      previousStatus: QueueStatus.ABANDONED,
      newStatus: QueueStatus.QUEUING,
      operatorId,
      operatorName,
      reason: '撤回后重新提交排队'
    });

    return record;
  }

  queryRecords(filter: QueryFilter): PaginatedResult<QueueRecord> {
    let records = Array.from(this.queueRecords.values());

    if (filter.startDate) {
      records = records.filter(r => r.createdAt >= filter.startDate!);
    }

    if (filter.endDate) {
      records = records.filter(r => r.createdAt <= filter.endDate!);
    }

    if (filter.status) {
      records = records.filter(r => r.status === filter.status);
    }

    if (filter.recordStatus) {
      records = records.filter(r => r.recordStatus === filter.recordStatus);
    }

    if (filter.ownerId) {
      records = records.filter(r => r.ownerId === filter.ownerId);
    }

    if (filter.businessObject) {
      records = records.filter(r => r.businessObject === filter.businessObject);
    }

    if (filter.skillGroupId) {
      records = records.filter(r => r.skillGroupId === filter.skillGroupId);
    }

    if (filter.visitorId) {
      records = records.filter(r => r.visitor.id === filter.visitorId);
    }

    const total = records.length;
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = records.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize
    };
  }

  getStatusHistory(queueRecordId: string): StatusHistory[] {
    return Array.from(this.statusHistories.values())
      .filter(h => h.queueRecordId === queueRecordId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getAllStatusHistories(): StatusHistory[] {
    return Array.from(this.statusHistories.values());
  }

  getExportRecords(filter: QueryFilter): ExportRecord[] {
    const result = this.queryRecords(filter);
    const allHistories = this.getAllStatusHistories();

    return result.data.map(record => {
      const histories = allHistories.filter(h => h.queueRecordId === record.id);
      const lastHistory = histories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      return {
        ...record,
        statusHistoryCount: histories.length,
        lastStatusChangeTime: lastHistory?.createdAt || record.createdAt
      };
    });
  }

  private addStatusHistory(params: {
    queueRecordId: string;
    previousStatus: QueueStatus | null;
    newStatus: QueueStatus;
    operatorId?: string;
    operatorName?: string;
    reason?: string;
  }): StatusHistory {
    const history: StatusHistory = {
      id: uuidv4(),
      queueRecordId: params.queueRecordId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      reason: params.reason,
      createdAt: new Date()
    };

    this.statusHistories.set(history.id, history);
    return history;
  }

  private updateQueueDuration(record: QueueRecord): void {
    const endTime = record.connectedTime || record.abandonedTime || new Date();
    record.queueDurationSeconds = Math.floor(
      (endTime.getTime() - record.queueStartTime.getTime()) / 1000
    );
  }

  hasActiveQueueForVisitor(visitorId: string, skillGroupId: string): boolean {
    return Array.from(this.queueRecords.values()).some(
      r => r.visitor.id === visitorId &&
           r.skillGroupId === skillGroupId &&
           (r.status === QueueStatus.QUEUING || r.status === QueueStatus.OVERFLOWING)
    );
  }

  clearAll(): void {
    this.queueRecords.clear();
    this.statusHistories.clear();
  }
}

export const queueStore = new QueueStore();