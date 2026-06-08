import { generateId } from './idGenerator';
import systemStore from '../store/systemStore';
import {
  AuditLogEntry,
  AuditAction,
  ChangeRecord
} from '../types';

export function createChangeRecord<T>(
  fieldName: string,
  originalValue: T,
  newValue: T,
  changedBy: string,
  changeReason: string
): ChangeRecord<T> {
  return {
    id: generateId(),
    fieldName,
    originalValue,
    newValue,
    changedBy,
    changedAt: new Date(),
    changeReason
  };
}

export function createAuditLog(
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  action: AuditAction,
  operator: string,
  summary: string,
  changes: ChangeRecord[] = [],
  nextStepContact?: string
): AuditLogEntry {
  const log: AuditLogEntry = {
    id: generateId(),
    entityType,
    entityId,
    action,
    operator,
    timestamp: new Date(),
    summary,
    changes,
    nextStepContact
  };
  systemStore.addAuditLog(log);
  return log;
}

export function appendChangeHistory<T>(
  history: ChangeRecord[],
  fieldName: string,
  originalValue: T,
  newValue: T,
  changedBy: string,
  changeReason: string
): ChangeRecord[] {
  const change = createChangeRecord(
    fieldName,
    originalValue,
    newValue,
    changedBy,
    changeReason
  );
  return [...history, change];
}

export function getEntityHistory(entityType: string, entityId: string): AuditLogEntry[] {
  return systemStore.getAuditLogsByEntity(entityType, entityId);
}

export function buildVersionList<T extends {
  id: string;
  changeHistory: ChangeRecord[];
  isRecalculated?: boolean;
  version?: number;
  totalScore?: number;
}>(entity: T, entityType: string): Array<{
  version: number;
  operator: string;
  operatedAt: Date;
  summary: string;
  scoreSnapshot?: number;
}> {
  const logs = getEntityHistory(entityType, entity.id);
  const versions: Array<{
    version: number;
    operator: string;
    operatedAt: Date;
    summary: string;
    scoreSnapshot?: number;
  }> = [];

  if (logs.length > 0) {
    logs.forEach((log, idx) => {
      versions.push({
        version: idx + 1,
        operator: log.operator,
        operatedAt: log.timestamp,
        summary: log.summary,
        scoreSnapshot: 'totalScore' in entity ? (entity as any).totalScore : undefined
      });
    });
  } else {
    versions.push({
      version: entity.version || 1,
      operator: 'system',
      operatedAt: new Date(),
      summary: '初始创建',
      scoreSnapshot: 'totalScore' in entity ? (entity as any).totalScore : undefined
    });
  }

  if (entity.changeHistory && entity.changeHistory.length > 0) {
    let vIdx = versions.length;
    entity.changeHistory.forEach(change => {
      versions.push({
        version: ++vIdx,
        operator: change.changedBy,
        operatedAt: change.changedAt,
        summary: `修改${change.fieldName}: ${change.changeReason}`,
        scoreSnapshot: 'totalScore' in entity ? (entity as any).totalScore : undefined
      });
    });
  }

  return versions;
}
