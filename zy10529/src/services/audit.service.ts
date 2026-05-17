import prisma from '../lib/prisma'

interface CreateAuditLogParams {
  promotionRecordId?: string
  action: string
  actionType: string
  performedBy: string
  oldValue?: any
  newValue?: any
  details?: string
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      promotionRecordId: params.promotionRecordId,
      action: params.action,
      actionType: params.actionType,
      performedBy: params.performedBy,
      oldValue: params.oldValue,
      newValue: params.newValue,
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    }
  })
}

interface CreateExceptionRecordParams {
  promotionId: string
  exceptionType: string
  errorCode: string
  errorMessage: string
  stackTrace?: string
  rawInput?: any
  processingContext?: any
}

export async function createExceptionRecord(params: CreateExceptionRecordParams) {
  return prisma.exceptionRecord.create({
    data: {
      promotionRecordId: params.promotionId,
      exceptionType: params.exceptionType,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      stackTrace: params.stackTrace,
      rawInput: params.rawInput,
      processingContext: params.processingContext
    }
  })
}

export async function resolveException(
  exceptionId: string,
  resolvedBy: string,
  resolutionNotes: string
) {
  return prisma.exceptionRecord.update({
    where: { id: exceptionId },
    data: {
      resolutionStatus: 'RESOLVED',
      resolvedBy,
      resolutionNotes,
      resolvedAt: new Date()
    }
  })
}

export async function getAuditLogs(promotionId: string) {
  return prisma.auditLog.findMany({
    where: { promotionRecordId: promotionId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function getExceptionRecords(promotionId: string) {
  return prisma.exceptionRecord.findMany({
    where: { promotionRecordId: promotionId },
    orderBy: { createdAt: 'desc' }
  })
}
