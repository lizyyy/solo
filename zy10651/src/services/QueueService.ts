import {
  CreateQueueRequest,
  QueueRecord,
  QueueStatus,
  QueryFilter,
  RecordStatus,
  StatusHistory
} from '../types';
import { queueStore } from '../store/QueueStore';

class QueueService {
  createQueueRecord(request: CreateQueueRequest): QueueRecord {
    if (queueStore.hasActiveQueueForVisitor(request.visitor.id, request.skillGroupId)) {
      const record = queueStore.createQueueRecord(request);
      queueStore.updateRecordStatus(record.id, RecordStatus.CONFLICT);
      return record;
    }

    return queueStore.createQueueRecord(request);
  }

  getQueueRecord(id: string): QueueRecord | undefined {
    return queueStore.getQueueRecord(id);
  }

  updateStatus(
    id: string,
    status: QueueStatus,
    operatorId?: string,
    operatorName?: string,
    reason?: string
  ): QueueRecord | null {
    const result = queueStore.updateQueueRecordStatus(id, status, operatorId, operatorName, reason);
    
    if (result && status === QueueStatus.CONNECTED) {
      queueStore.updateRecordStatus(id, RecordStatus.COMPLETED);
      return queueStore.getQueueRecord(id) || null;
    }
    
    return result;
  }

  processOverflow(
    recordId: string,
    operatorId?: string,
    operatorName?: string
  ): { originalRecord: QueueRecord | null; placeholderRecord: QueueRecord | null } {
    const originalRecord = queueStore.getQueueRecord(recordId);
    if (!originalRecord) {
      return { originalRecord: null, placeholderRecord: null };
    }

    if (!originalRecord.overflowTargetId) {
      return { originalRecord, placeholderRecord: null };
    }

    const updatedRecord = queueStore.updateQueueRecordStatus(
      recordId,
      QueueStatus.OVERFLOWING,
      operatorId,
      operatorName,
      '原技能组溢出，流转到目标技能组'
    );

    if (!updatedRecord) {
      return { originalRecord, placeholderRecord: null };
    }

    const placeholderRecord = queueStore.createOverflowPlaceholder(
      originalRecord,
      operatorId,
      operatorName
    );

    return { originalRecord: updatedRecord, placeholderRecord };
  }

  withdrawQueueRecord(
    id: string,
    operatorId?: string,
    operatorName?: string
  ): QueueRecord | null {
    return queueStore.withdrawQueueRecord(id, operatorId, operatorName);
  }

  resubmitQueueRecord(
    id: string,
    operatorId?: string,
    operatorName?: string
  ): QueueRecord | null {
    return queueStore.resubmitQueueRecord(id, operatorId, operatorName);
  }

  queryRecords(filter: QueryFilter) {
    return queueStore.queryRecords(filter);
  }

  getStatusHistory(queueRecordId: string): StatusHistory[] {
    return queueStore.getStatusHistory(queueRecordId);
  }

  rejectRecord(
    id: string,
    operatorId?: string,
    operatorName?: string,
    reason?: string
  ): QueueRecord | null {
    const record = queueStore.getQueueRecord(id);
    if (!record) {
      return null;
    }

    queueStore.updateQueueRecordStatus(
      id,
      QueueStatus.ABANDONED,
      operatorId,
      operatorName,
      reason || '记录被驳回'
    );

    return queueStore.updateRecordStatus(id, RecordStatus.REJECTED);
  }
}

export const queueService = new QueueService();