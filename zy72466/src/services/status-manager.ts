import {
  ComplaintRecord,
  ComplaintStatus,
  StatusChangeLog,
  OperationType,
} from '../types';
import { dataStore } from '../store';
import { generateId, now, deepClone } from '../utils';
import { canTransitionStatus, BoundaryRules } from '../boundary-rules';

export class StatusManager {
  static createStatusLog(
    record: ComplaintRecord,
    toStatus: ComplaintStatus,
    operationType: OperationType,
    operator: string,
    remark?: string
  ): StatusChangeLog {
    return {
      id: generateId(),
      recordId: record.id,
      fromStatus: record.currentStatus,
      toStatus,
      operationType,
      operator,
      operationTime: now(),
      remark,
      snapshotBefore: deepClone(record) as unknown as Record<string, unknown>,
    };
  }

  static transitionStatus(
    recordId: string,
    toStatus: ComplaintStatus,
    operationType: OperationType,
    operator: string,
    remark?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (!canTransitionStatus(record.currentStatus, toStatus)) {
      throw new Error(
        `状态流转不允许: ${record.currentStatus} -> ${toStatus}`
      );
    }

    const log = this.createStatusLog(
      record,
      toStatus,
      operationType,
      operator,
      remark
    );

    record.currentStatus = toStatus;
    record.statusLogs.push(log);

    dataStore.saveLog(log);
    dataStore.saveRecord(record);

    return record;
  }

  static rollbackToLog(recordId: string, logId: string, operator: string): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const targetLogIndex = record.statusLogs.findIndex((l: StatusChangeLog) => l.id === logId);
    if (targetLogIndex === -1) {
      throw new Error('找不到指定的操作记录');
    }

    const targetLog = record.statusLogs[targetLogIndex];
    const timeDiff = Date.now() - new Date(targetLog.operationTime).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > BoundaryRules.rollback.allowedWindowHours) {
      throw new Error(
        `超过回滚时限 (${BoundaryRules.rollback.allowedWindowHours}小时)`
      );
    }

    const allowedOps = BoundaryRules.rollback.allowedOperations as unknown as string[];
    if (!allowedOps.includes(targetLog.operationType)) {
      throw new Error(`该操作类型不支持回滚: ${targetLog.operationType}`);
    }

    const snapshot = deepClone(targetLog.snapshotBefore) as unknown as ComplaintRecord;

    const rollbackLog: StatusChangeLog = {
      id: generateId(),
      recordId: record.id,
      fromStatus: record.currentStatus,
      toStatus: targetLog.fromStatus || ComplaintStatus.IMPORTED,
      operationType: OperationType.ROLLBACK,
      operator,
      operationTime: now(),
      remark: `回滚到操作 ${logId}`,
      snapshotBefore: deepClone(record) as unknown as Record<string, unknown>,
    };

    snapshot.statusLogs.push(rollbackLog);
    dataStore.saveLog(rollbackLog);
    dataStore.saveRecord(snapshot);

    return snapshot;
  }

  static getOperationHistory(recordId: string): StatusChangeLog[] {
    return dataStore.getLogsForRecord(recordId);
  }
}
