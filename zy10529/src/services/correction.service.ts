import prisma from '../lib/prisma'
import { ManualCorrectionRequest } from '../types'
import { createAuditLog, createExceptionRecord } from './audit.service'

export class CorrectionService {
  async createCorrection(request: ManualCorrectionRequest, operator: string) {
    try {
      const promotion = await prisma.promotionRecord.findUnique({
        where: { id: request.promotionId }
      })

      if (!promotion) {
        throw new Error('晋级记录不存在')
      }

      const correction = await prisma.correctionRecord.create({
        data: {
          promotionRecordId: request.promotionId,
          correctionType: request.correctionType,
          fieldName: request.fieldName,
          oldValue: request.oldValue,
          newValue: request.newValue,
          reason: request.reason,
          correctedBy: request.correctedBy,
          approvalRequired: request.approvalRequired || false
        }
      })

      await createAuditLog({
        promotionRecordId: request.promotionId,
        action: '人工修正',
        actionType: 'CORRECTION',
        performedBy: operator,
        oldValue: { [request.fieldName]: request.oldValue },
        newValue: { [request.fieldName]: request.newValue },
        details: request.reason
      })

      return correction
    } catch (error: any) {
      await createExceptionRecord({
        promotionId: request.promotionId,
        exceptionType: 'CREATE_CORRECTION_ERROR',
        errorCode: 'E005',
        errorMessage: error.message,
        stackTrace: error.stack,
        rawInput: request as any,
        processingContext: { operator }
      })
      throw error
    }
  }

  async approveCorrection(
    correctionId: string,
    approvedBy: string
  ) {
    const correction = await prisma.correctionRecord.findUnique({
      where: { id: correctionId }
    })

    if (!correction) {
      throw new Error('修正记录不存在')
    }

    return prisma.correctionRecord.update({
      where: { id: correctionId },
      data: {
        approvedBy,
        approvedAt: new Date()
      }
    })
  }

  async getCorrections(promotionId: string) {
    return prisma.correctionRecord.findMany({
      where: { promotionRecordId: promotionId },
      orderBy: { createdAt: 'desc' }
    })
  }
}

export const correctionService = new CorrectionService()
