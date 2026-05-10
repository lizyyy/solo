import prisma from '../prisma';

export interface AuditLogCreate {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userName?: string;
  beforeState?: unknown;
  afterState?: unknown;
  remarks?: string;
  projectId?: string;
  questionId?: string;
  clarificationId?: string;
  addendumId?: string;
  archiveId?: string;
}

export async function createAuditLog(params: AuditLogCreate) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      userName: params.userName,
      beforeState: params.beforeState ? JSON.stringify(params.beforeState) : null,
      afterState: params.afterState ? JSON.stringify(params.afterState) : null,
      remarks: params.remarks,
      projectId: params.projectId,
      questionId: params.questionId,
      clarificationId: params.clarificationId,
      addendumId: params.addendumId,
      archiveId: params.archiveId,
    },
  });
}

export async function getAuditLogsByEntity(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAuditLogsByProject(projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}
