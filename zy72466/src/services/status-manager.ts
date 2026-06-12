import {
  ComplaintRecord,
  ComplaintStatus,
  StatusChangeLog,
  OperationType,
  FieldDiff,
} from '../types';
import { dataStore } from '../store';
import { generateId, now, deepClone } from '../utils';
import { canTransitionStatus, BoundaryRules } from '../boundary-rules';

type RecordMutator = (record: ComplaintRecord) => void;

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path: string = ''
): { fieldsChanged: string[]; diff: Record<string, FieldDiff> } {
  const fieldsChanged: string[] = [];
  const diff: Record<string, FieldDiff> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

  for (const key of Array.from(allKeys)) {
    const fullKey = path ? `${path}.${key}` : key;
    const b = before[key];
    const a = after[key];

    const bObj = isPlainObject(b);
    const aObj = isPlainObject(a);

    if (bObj && aObj) {
      const nested = computeDiff(
        b as Record<string, unknown>,
        a as Record<string, unknown>,
        fullKey
      );
      fieldsChanged.push(...nested.fieldsChanged);
      Object.assign(diff, nested.diff);
      continue;
    }

    if (bObj && !aObj) {
      const nested = computeDiff(
        b as Record<string, unknown>,
        {},
        fullKey
      );
      fieldsChanged.push(...nested.fieldsChanged);
      Object.assign(diff, nested.diff);
      continue;
    }

    if (!bObj && aObj) {
      const nested = computeDiff(
        {},
        a as Record<string, unknown>,
        fullKey
      );
      fieldsChanged.push(...nested.fieldsChanged);
      Object.assign(diff, nested.diff);
      continue;
    }

    const bStr = JSON.stringify(b);
    const aStr = JSON.stringify(a);

    if (bStr !== aStr) {
      fieldsChanged.push(fullKey);
      diff[fullKey] = { before: b, after: a };
    }
  }

  return { fieldsChanged, diff };
}

export class StatusManager {
  static createLogWithDiff(
    snapshotBeforeObj: ComplaintRecord,
    recordAfter: ComplaintRecord,
    toStatus: ComplaintStatus,
    operationType: OperationType,
    operator: string,
    remark?: string
  ): StatusChangeLog {
    const fromStatus = snapshotBeforeObj.currentStatus;

    const beforeForDiff = deepClone(snapshotBeforeObj) as unknown as Record<string, unknown>;
    const afterForDiff = deepClone(recordAfter) as unknown as Record<string, unknown>;
    delete beforeForDiff.statusLogs;
    delete afterForDiff.statusLogs;
    delete beforeForDiff.updatedAt;
    delete afterForDiff.updatedAt;

    const { fieldsChanged, diff } = computeDiff(beforeForDiff, afterForDiff);

    const statusKey = 'currentStatus';
    if (fromStatus !== toStatus) {
      if (!fieldsChanged.includes(statusKey)) {
        fieldsChanged.unshift(statusKey);
      }
      diff[statusKey] = { before: fromStatus, after: toStatus };
    }

    return {
      id: generateId(),
      recordId: snapshotBeforeObj.id,
      fromStatus,
      toStatus,
      operationType,
      operator,
      operationTime: now(),
      remark,
      snapshotBefore: deepClone(snapshotBeforeObj) as unknown as Record<string, unknown>,
      fieldsChanged,
      diff,
    };
  }

  static executeWithTransition(
    recordId: string,
    toStatus: ComplaintStatus,
    operationType: OperationType,
    operator: string,
    mutator: RecordMutator,
    remark?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (!canTransitionStatus(record.currentStatus, toStatus)) {
      throw new Error(
        `状态流转不允许: ${record.currentStatus} -> ${toStatus}`
      );
    }

    const snapshotBefore = deepClone(record);

    mutator(record);

    record.currentStatus = toStatus;

    const log = this.createLogWithDiff(
      snapshotBefore,
      record,
      toStatus,
      operationType,
      operator,
      remark
    );

    record.statusLogs.push(log);

    dataStore.saveLog(log);
    dataStore.saveRecord(record);

    return record;
  }

  static executeManualEdit(
    recordId: string,
    operator: string,
    mutator: RecordMutator,
    remark?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const snapshotBefore = deepClone(record);

    mutator(record);

    const toStatus = record.currentStatus;

    const log = this.createLogWithDiff(
      snapshotBefore,
      record,
      toStatus,
      OperationType.MANUAL_EDIT,
      operator,
      remark || '人工补录/修改'
    );

    record.statusLogs.push(log);

    dataStore.saveLog(log);
    dataStore.saveRecord(record);

    return record;
  }

  static rollbackToLog(
    recordId: string,
    logId: string,
    operator: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const targetLogIndex = record.statusLogs.findIndex(
      (l: StatusChangeLog) => l.id === logId
    );
    if (targetLogIndex === -1) {
      throw new Error('找不到指定的操作记录');
    }

    const targetLog = record.statusLogs[targetLogIndex];
    const timeDiff =
      Date.now() - new Date(targetLog.operationTime).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > BoundaryRules.rollback.allowedWindowHours) {
      throw new Error(
        `超过回滚时限 (${BoundaryRules.rollback.allowedWindowHours}小时)`
      );
    }

    const allowedOps = BoundaryRules.rollback.allowedOperations as unknown as string[];
    if (!allowedOps.includes(targetLog.operationType)) {
      throw new Error(
        `该操作类型不支持回滚: ${targetLog.operationType}`
      );
    }

    const restored = deepClone(
      targetLog.snapshotBefore
    ) as unknown as ComplaintRecord;

    const logsBeforeTarget = record.statusLogs.slice(0, targetLogIndex);
    restored.statusLogs = [...logsBeforeTarget];

    const rollbackLog: StatusChangeLog = (() => {
      const beforeForDiff = deepClone(record) as unknown as Record<string, unknown>;
      const afterForDiff = deepClone(restored) as unknown as Record<string, unknown>;
      delete beforeForDiff.statusLogs;
      delete afterForDiff.statusLogs;
      delete beforeForDiff.updatedAt;
      delete afterForDiff.updatedAt;

      const { fieldsChanged, diff } = computeDiff(
        beforeForDiff, afterForDiff);

      const statusKey = 'currentStatus';
      if (record.currentStatus !== restored.currentStatus) {
        if (!fieldsChanged.includes(statusKey)) {
          fieldsChanged.unshift(statusKey);
        }
        diff[statusKey] = {
          before: record.currentStatus,
          after: restored.currentStatus,
        };
      }

      return {
        id: generateId(),
        recordId: record.id,
        fromStatus: record.currentStatus,
        toStatus: restored.currentStatus,
        operationType: OperationType.ROLLBACK,
        operator,
        operationTime: now(),
        remark: `回滚到操作 ${logId}，影响字段: ${fieldsChanged.join(', ')}`,
        snapshotBefore: deepClone(record) as unknown as Record<string, unknown>,
        fieldsChanged,
        diff,
      };
    })();

    restored.statusLogs.push(rollbackLog);
    dataStore.saveLog(rollbackLog);
    dataStore.saveRecord(restored);

    return restored;
  }

  static getOperationHistory(recordId: string): StatusChangeLog[] {
    return dataStore.getLogsForRecord(recordId);
  }
}
