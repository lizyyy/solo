import prisma from './prisma';

export async function createAuditLog(
  recordId: string,
  action: string,
  operator: string,
  oldStatus?: string,
  newStatus?: string,
  reason?: string,
  details?: string
) {
  return prisma.auditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recordId,
      action,
      oldStatus,
      newStatus,
      reason,
      operator,
      details,
    },
  });
}
