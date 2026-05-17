import prisma from '../lib/prisma'
import { SubmitApprovalRequest } from '../types'
import { PromotionStatus, ApprovalDecision } from '@prisma/client'
import { createAuditLog, createExceptionRecord } from './audit.service'
import { promotionService } from './promotion.service'

export class ApprovalService {
  async submitApproval(request: SubmitApprovalRequest, operator: string) {
    try {
      const promotion = await prisma.promotionRecord.findUnique({
        where: { id: request.promotionId },
        include: { approvals: true }
      })

      if (!promotion) {
        throw new Error('晋级记录不存在')
      }

      if (![PromotionStatus.SIGNED, PromotionStatus.PENDING_APPROVAL].includes(promotion.status)) {
        throw new Error('当前状态不允许审批')
      }

      const oldStatus = promotion.status

      const existingApproval = await prisma.approvalRecord.findFirst({
        where: {
          promotionRecordId: request.promotionId,
          approver: request.approver,
          sequenceOrder: request.sequenceOrder || 1
        }
      })

      if (existingApproval) {
        throw new Error('该审批人已提交审批')
      }

      const approval = await prisma.approvalRecord.create({
        data: {
          promotionRecordId: request.promotionId,
          approver: request.approver,
          approverRole: request.approverRole,
          decision: request.decision,
          comments: request.comments,
          sequenceOrder: request.sequenceOrder || 1,
          approvedAt: new Date()
        }
      })

      let newStatus = promotion.status
      let newStep = promotion.currentStep
      let isCompleted = false

      if (request.decision === ApprovalDecision.REJECT) {
        newStatus = PromotionStatus.REJECTED
      } else if (request.decision === ApprovalDecision.APPROVE) {
        const requiredApprovals = 1
        const approvedCount = await prisma.approvalRecord.count({
          where: {
            promotionRecordId: request.promotionId,
            decision: ApprovalDecision.APPROVE
          }
        })

        if (approvedCount >= requiredApprovals) {
          newStatus = PromotionStatus.APPROVED
          newStep = 4
        } else {
          newStatus = PromotionStatus.PENDING_APPROVAL
          newStep = 3
        }

        if (newStatus === PromotionStatus.APPROVED) {
          isCompleted = true
        }
      }

      const updatedPromotion = await prisma.promotionRecord.update({
        where: { id: request.promotionId },
        data: {
          status: newStatus,
          currentStep: newStep,
          completedAt: isCompleted ? new Date() : null
        },
        include: {
          artifactVersion: true,
          approvals: true
        }
      })

      await createAuditLog({
        promotionRecordId: request.promotionId,
        action: '提交审批',
        actionType: 'APPROVAL',
        performedBy: operator,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, decision: request.decision }
      })

      return promotionService.formatPromotionDetail(updatedPromotion as any)
    } catch (error: any) {
      await createExceptionRecord({
        promotionId: request.promotionId,
        exceptionType: 'SUBMIT_APPROVAL_ERROR',
        errorCode: 'E004',
        errorMessage: error.message,
        stackTrace: error.stack,
        rawInput: request as any,
        processingContext: { operator }
      })
      throw error
    }
  }

  async completePromotion(promotionId: string, operator: string) {
    const promotion = await prisma.promotionRecord.findUnique({
      where: { id: promotionId }
    })

    if (!promotion) {
      throw new Error('晋级记录不存在')
    }

    if (promotion.status !== PromotionStatus.APPROVED) {
      throw new Error('当前状态不允许完成晋级')
    }

    const updated = await prisma.promotionRecord.update({
      where: { id: promotionId },
      data: {
        status: PromotionStatus.PROMOTED,
        completedAt: new Date()
      },
      include: {
        artifactVersion: true
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '完成晋级',
      actionType: 'STATUS_CHANGE',
      performedBy: operator,
      oldValue: { status: promotion.status },
      newValue: { status: PromotionStatus.PROMOTED }
    })

    return promotionService.formatPromotionDetail(updated as any)
  }

  async getApprovalRecords(promotionId: string) {
    return prisma.approvalRecord.findMany({
      where: { promotionRecordId: promotionId },
      orderBy: { sequenceOrder: 'asc' }
    })
  }

  async checkAllApproved(promotionId: string): Promise<boolean> {
    const approvals = await prisma.approvalRecord.findMany({
      where: { promotionRecordId: promotionId }
    })

    if (approvals.length === 0) return false

    return approvals.every(a => a.decision === ApprovalDecision.APPROVE)
  }
}

export const approvalService = new ApprovalService()
