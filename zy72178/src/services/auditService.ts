import { generateUUID } from '../utils/crypto';
import { getCurrentISO } from '../utils/date';
import { addToStore, getFromIndex } from '../db';
import type { AuditLog, EntityType, AuditAction } from '../types';

const DEFAULT_USER = '小乔';

export async function logAction(
  entityType: EntityType,
  entityId: string,
  action: AuditAction,
  beforeState?: Record<string, any>,
  afterState?: Record<string, any>,
  operator?: string
): Promise<void> {
  const now = getCurrentISO();
  const user = operator || DEFAULT_USER;
  const log: AuditLog = {
    id: generateUUID(),
    entityType,
    entityId,
    action,
    beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : undefined,
    afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : undefined,
    createdAt: now,
    createdBy: user,
    operator: user,
    timestamp: now,
    metadata: {},
  };

  await addToStore('auditLogs', log);
}

export async function getEntityHistory(
  entityType: EntityType,
  entityId: string
): Promise<AuditLog[]> {
  const logs = await getFromIndex('auditLogs', 'by-entity', IDBKeyRange.only([entityType, entityId]));
  return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllAuditLogs(limit?: number): Promise<AuditLog[]> {
  const logs = await getFromIndex('auditLogs', 'by-createdAt', null);
  const sorted = logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return limit ? sorted.slice(0, limit) : sorted;
}
