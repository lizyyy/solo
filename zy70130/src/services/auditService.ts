import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getAuditLogsByTargetKey, getFreezeKey } from '../database';
import { AuditLog, FreezeRecord, FreezeType } from '../types';

export class AuditService {
  logAudit(
    action: string,
    actorId: string,
    actorType: AuditLog['actorType'],
    targetType: string,
    targetId: string,
    beforeState: string,
    afterState: string,
    requestId: string
  ): AuditLog {
    const db = getDatabase();
    const now = Date.now();

    const auditLog: AuditLog = {
      id: uuidv4(),
      action,
      actorId,
      actorType,
      targetType,
      targetId,
      beforeState,
      afterState,
      timestamp: now,
      requestId,
    };

    const targetKey = getAuditLogsByTargetKey(targetType, targetId);
    const existingLogs = db.auditLogs.get(targetKey) || [];
    existingLogs.push(auditLog);
    db.auditLogs.set(targetKey, existingLogs);

    return auditLog;
  }

  getAuditLogsByTarget(targetType: string, targetId: string): AuditLog[] {
    const db = getDatabase();
    const targetKey = getAuditLogsByTargetKey(targetType, targetId);
    const logs = db.auditLogs.get(targetKey) || [];
    return [...logs].sort((a, b) => b.timestamp - a.timestamp);
  }

  getAuditLogsByActor(actorId: string): AuditLog[] {
    const db = getDatabase();
    const allLogs: AuditLog[] = [];
    for (const logs of db.auditLogs.values()) {
      allLogs.push(...logs.filter((log) => log.actorId === actorId));
    }
    return allLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  getAuditLogsByAction(action: string): AuditLog[] {
    const db = getDatabase();
    const allLogs: AuditLog[] = [];
    for (const logs of db.auditLogs.values()) {
      allLogs.push(...logs.filter((log) => log.action === action));
    }
    return allLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  freezeTarget(
    targetType: FreezeType,
    targetId: string,
    reason: string,
    operatorId: string
  ): FreezeRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const freezeKey = getFreezeKey(targetType, targetId);
    const activeFreeze = db.freezeRecords.get(freezeKey);
    if (activeFreeze && activeFreeze.isActive) {
      throw new Error('目标已被冻结');
    }

    const freezeRecord: FreezeRecord = {
      id: uuidv4(),
      targetType,
      targetId,
      reason,
      operatorId,
      isActive: true,
      createdAt: now,
      releasedAt: null,
    };

    db.freezeRecords.set(freezeKey, freezeRecord);

    this.logAudit(
      'freeze',
      operatorId,
      'admin',
      targetType,
      targetId,
      JSON.stringify({ isFrozen: false }),
      JSON.stringify({ isFrozen: true, reason }),
      requestId
    );

    return freezeRecord;
  }

  unfreezeTarget(
    targetType: FreezeType,
    targetId: string,
    operatorId: string
  ): FreezeRecord {
    const db = getDatabase();
    const now = Date.now();
    const requestId = uuidv4();

    const freezeKey = getFreezeKey(targetType, targetId);
    const freezeRecord = db.freezeRecords.get(freezeKey);
    if (!freezeRecord || !freezeRecord.isActive) {
      throw new Error('目标未被冻结');
    }

    const updated: FreezeRecord = {
      ...freezeRecord,
      isActive: false,
      releasedAt: now,
    };
    db.freezeRecords.set(freezeKey, updated);

    this.logAudit(
      'unfreeze',
      operatorId,
      'admin',
      targetType,
      targetId,
      JSON.stringify({ isFrozen: true }),
      JSON.stringify({ isFrozen: false }),
      requestId
    );

    return updated;
  }

  isTargetFrozen(targetType: FreezeType, targetId: string): boolean {
    const db = getDatabase();
    const freezeKey = getFreezeKey(targetType, targetId);
    const freezeRecord = db.freezeRecords.get(freezeKey);
    return !!(freezeRecord && freezeRecord.isActive);
  }

  getActiveFreeze(targetType: FreezeType, targetId: string): FreezeRecord | null {
    const db = getDatabase();
    const freezeKey = getFreezeKey(targetType, targetId);
    const freezeRecord = db.freezeRecords.get(freezeKey);
    if (!freezeRecord || !freezeRecord.isActive) {
      return null;
    }
    return freezeRecord;
  }

  getFreezeHistory(targetType: FreezeType, targetId: string): FreezeRecord[] {
    const db = getDatabase();
    const history: FreezeRecord[] = [];
    for (const record of db.freezeRecords.values()) {
      if (record.targetType === targetType && record.targetId === targetId) {
        history.push(record);
      }
    }
    return history.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const auditService = new AuditService();
