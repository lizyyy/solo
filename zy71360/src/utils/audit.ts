import type { AuditLog, AuditAction, Shot, User } from '@/types';
import { generateId } from './version';

export function createAuditLog(
  action: AuditAction,
  shotId: string,
  user: User,
  reason: string,
  details: Record<string, any>,
  versionId?: string,
  shotNumber?: string,
  message?: string,
  versionFrom?: string,
  versionTo?: string,
  fieldChanges?: number,
  isRollback?: boolean
): AuditLog {
  return {
    id: generateId(),
    shotId,
    shotNumber,
    versionId,
    action,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    message: message || getActionLabel(action),
    timestamp: new Date().toISOString(),
    details,
    reason,
    versionFrom,
    versionTo,
    fieldChanges,
    isRollback,
  };
}

export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: '创建镜头',
    edit: '编辑修改',
    lock: '锁定版本',
    unlock: '解锁版本',
    rollback: '版本回滚',
    compare: '版本对比',
    export: '导出报告',
  };
  return labels[action];
}

export function getAuditTrail(
  auditLogs: AuditLog[],
  shotId?: string,
  startDate?: string,
  endDate?: string
): AuditLog[] {
  let filtered = [...auditLogs];

  if (shotId) {
    filtered = filtered.filter((log) => log.shotId === shotId);
  }

  if (startDate) {
    filtered = filtered.filter((log) => log.timestamp >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((log) => log.timestamp <= endDate);
  }

  return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface MonthlyStats {
  total: number;
  updates: number;
  rollbacks: number;
  locks: number;
  unlocks: number;
  totalShots: number;
  newShots: number;
  totalVersions: number;
  edits: number;
  fieldChangesTotal: number;
  shotsAffected: number;
  mostActiveUser?: User;
  userStats: Record<string, number>;
}

export function generateMonthlyStats(
  auditLogs: AuditLog[],
  yearMonth: string,
  selectedShotId?: string,
  shots: Shot[] = []
): MonthlyStats {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

  const monthLogs = auditLogs.filter(
    (log) => log.timestamp >= startOfMonth && log.timestamp <= endOfMonth
  );

  const filteredLogs = selectedShotId
    ? monthLogs.filter((l) => l.shotId === selectedShotId)
    : monthLogs;

  const monthShots = shots.filter(
    (shot) => shot.createdAt >= startOfMonth && shot.createdAt <= endOfMonth
  );

  const userStats: Record<string, number> = {};
  let fieldChangesTotal = 0;
  const affectedShotIds = new Set<string>();

  filteredLogs.forEach((log) => {
    userStats[log.userId] = (userStats[log.userId] || 0) + 1;
    if (log.fieldChanges) {
      fieldChangesTotal += log.fieldChanges;
    }
    if (log.shotId !== 'system') {
      affectedShotIds.add(log.shotId);
    }
  });

  let mostActiveUser: User | undefined;
  let maxCount = 0;
  Object.entries(userStats).forEach(([userId, count]) => {
    if (count > maxCount) {
      maxCount = count;
      const log = filteredLogs.find((l) => l.userId === userId);
      if (log) {
        mostActiveUser = {
          id: log.userId,
          name: log.userName,
          role: log.userRole,
        };
      }
    }
  });

  return {
    total: filteredLogs.length,
    updates: filteredLogs.filter((l) => l.action === 'edit').length,
    rollbacks: filteredLogs.filter((l) => l.action === 'rollback').length,
    locks: filteredLogs.filter((l) => l.action === 'lock').length,
    unlocks: filteredLogs.filter((l) => l.action === 'unlock').length,
    totalShots: shots.length,
    newShots: selectedShotId ? 0 : monthShots.length,
    totalVersions: shots.reduce((sum, s) => sum + s.versions.length, 0),
    edits: filteredLogs.filter((l) => l.action === 'edit').length,
    fieldChangesTotal,
    shotsAffected: affectedShotIds.size,
    mostActiveUser,
    userStats,
  };
}
