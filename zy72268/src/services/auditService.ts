import { db } from '../db';
import type { AuditLog, User } from '../types';
import { generateId } from './conflictDetectionService';

export async function logChange(
  user: User,
  action: string,
  targetType: string,
  targetId: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  reason: string,
  affectedItems: string[] = []
): Promise<void> {
  const log: AuditLog = {
    id: generateId(),
    userId: user.id,
    userName: user.name,
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    reason,
    createdAt: new Date(),
    affectedItems,
  };

  await db.auditLogs.add(log);
}

export async function getHistoryByTarget(targetId: string): Promise<AuditLog[]> {
  return db.auditLogs.where('targetId').equals(targetId).reverse().sortBy('createdAt');
}

export async function getHistoryByUser(userId: string): Promise<AuditLog[]> {
  return db.auditLogs.where('userId').equals(userId).reverse().sortBy('createdAt');
}

export async function getAllHistory(): Promise<AuditLog[]> {
  return db.auditLogs.reverse().sortBy('createdAt');
}

export async function getAffectedItems(logId: string): Promise<string[]> {
  const log = await db.auditLogs.get(logId);
  return log?.affectedItems ?? [];
}

export function getActionDescription(action: string, targetType: string): string {
  const actionMap: Record<string, string> = {
    'create': `创建${targetType}`,
    'update': `更新${targetType}`,
    'delete': `删除${targetType}`,
    'merge': `合并${targetType}`,
    'confirm': `确认${targetType}`,
    'reject': `驳回${targetType}`,
    'import': `导入${targetType}`,
    'export': `导出${targetType}`,
    'review': `复核${targetType}`,
  };
  return actionMap[action] || `${action} ${targetType}`;
}
