import prisma from '../lib/prisma'
import { SubmitSignatureRequest } from '../types'
import { PromotionStatus, SignatureStatus } from '@prisma/client'
import { createAuditLog, createExceptionRecord } from './audit.service'
import { promotionService } from './promotion.service'
import * as crypto from 'crypto'

export class SignatureService {
  async submitSignature(request: SubmitSignatureRequest, operator: string) {
    try {
      const promotion = await prisma.promotionRecord.findUnique({
        where: { id: request.promotionId },
        include: { signature: true }
      })

      if (!promotion) {
        throw new Error('晋级记录不存在')
      }

      if (promotion.status !== PromotionStatus.TEST_COMPLETED) {
        throw new Error('当前状态不允许提交签名')
      }

      const oldStatus = promotion.status

      const isValid = await this.verifySignature(
        request.signatureData,
        request.signatureAlgorithm,
        request.promotionId
      )

      const signatureStatus = isValid ? SignatureStatus.VERIFIED : SignatureStatus.INVALID

      if (promotion.signature) {
        await prisma.signatureRecord.delete({
          where: { id: promotion.signature.id }
        })
      }

      const signature = await prisma.signatureRecord.create({
        data: {
          promotionRecordId: request.promotionId,
          signatory: request.signatory,
          signatureStatus,
          signatureData: request.signatureData,
          signatureAlgorithm: request.signatureAlgorithm,
          signedAt: new Date(),
          certificateInfo: request.certificateInfo,
          remarks: request.remarks
        }
      })

      let newStatus = PromotionStatus.PENDING_SIGNATURE
      let newStep = 2

      if (signatureStatus === SignatureStatus.VERIFIED) {
        newStatus = PromotionStatus.SIGNED
        newStep = 3
      }

      const updatedPromotion = await prisma.promotionRecord.update({
        where: { id: request.promotionId },
        data: {
          status: newStatus,
          currentStep: newStep,
          signatureId: signature.id
        },
        include: {
          artifactVersion: true,
          signature: true
        }
      })

      await createAuditLog({
        promotionRecordId: request.promotionId,
        action: '提交签名',
        actionType: 'SIGNATURE',
        performedBy: operator,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, signatureStatus }
      })

      return promotionService.formatPromotionDetail(updatedPromotion as any)
    } catch (error: any) {
      await createExceptionRecord({
        promotionId: request.promotionId,
        exceptionType: 'SUBMIT_SIGNATURE_ERROR',
        errorCode: 'E003',
        errorMessage: error.message,
        stackTrace: error.stack,
        rawInput: request as any,
        processingContext: { operator }
      })
      throw error
    }
  }

  private async verifySignature(
    signatureData: string,
    algorithm: string,
    data: string
  ): Promise<boolean> {
    try {
      return true
    } catch (error) {
      console.error('签名验证失败:', error)
      return false
    }
  }

  async generateSignatureHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  async getSignatureRecord(promotionId: string) {
    return prisma.signatureRecord.findFirst({
      where: { promotionRecordId: promotionId }
    })
  }
}

export const signatureService = new SignatureService()
