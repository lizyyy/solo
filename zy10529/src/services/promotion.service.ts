import prisma from '../lib/prisma'
import {
  CreatePromotionRequest,
  PromotionQueryParams,
  PromotionDetail
} from '../types'
import { PromotionStatus, EnvironmentStage } from '@prisma/client'
import { createAuditLog, createExceptionRecord } from './audit.service'

export class PromotionService {
  async createPromotion(request: CreatePromotionRequest, operator: string) {
    try {
      let artifactVersion = await prisma.artifactVersion.findFirst({
        where: {
          artifactName: request.artifactName,
          version: request.version
        }
      })

      if (!artifactVersion) {
        artifactVersion = await prisma.artifactVersion.create({
          data: {
            artifactName: request.artifactName,
            version: request.version,
            buildNumber: request.buildNumber,
            commitHash: request.commitHash,
            buildBranch: request.buildBranch,
            buildTime: request.buildTime ? new Date(request.buildTime) : null,
            artifactUrl: request.artifactUrl,
            checksum: request.checksum,
            checksumAlgorithm: request.checksumAlgorithm,
            metadata: request.metadata
          }
        })
      }

      const promotion = await prisma.promotionRecord.create({
        data: {
          artifactVersionId: artifactVersion.id,
          fromEnvironment: request.fromEnvironment,
          toEnvironment: request.toEnvironment,
          title: request.title,
          description: request.description,
          initiator: request.initiator,
          status: PromotionStatus.DRAFT,
          currentStep: 0,
          totalSteps: 4
        },
        include: {
          artifactVersion: true
        }
      })

      await createAuditLog({
        promotionRecordId: promotion.id,
        action: '创建晋级申请',
        actionType: 'CREATE',
        performedBy: operator,
        newValue: promotion as any
      })

      return this.formatPromotionDetail(promotion as any)
    } catch (error: any) {
      await createExceptionRecord({
        promotionId: '',
        exceptionType: 'CREATE_PROMOTION_ERROR',
        errorCode: 'E001',
        errorMessage: error.message,
        stackTrace: error.stack,
        rawInput: request as any,
        processingContext: { operator }
      })
      throw error
    }
  }

  async getPromotionById(id: string) {
    const promotion = await prisma.promotionRecord.findUnique({
      where: { id },
      include: {
        artifactVersion: true,
        testSummary: true,
        signature: true,
        approvals: {
          orderBy: { sequenceOrder: 'asc' }
        },
        corrections: {
          orderBy: { createdAt: 'desc' }
        },
        exceptions: {
          orderBy: { createdAt: 'desc' }
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!promotion) {
      return null
    }

    return this.formatPromotionDetail(promotion as any)
  }

  async queryPromotions(params: PromotionQueryParams) {
    const {
      artifactName,
      version,
      fromEnvironment,
      toEnvironment,
      status,
      initiator,
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = params

    const where: any = {}

    if (artifactName) {
      where.artifactVersion = {
        artifactName: { contains: artifactName }
      }
    }

    if (version) {
      if (!where.artifactVersion) where.artifactVersion = {}
      where.artifactVersion.version = { contains: version }
    }

    if (fromEnvironment) {
      where.fromEnvironment = fromEnvironment
    }

    if (toEnvironment) {
      where.toEnvironment = toEnvironment
    }

    if (status) {
      where.status = status
    }

    if (initiator) {
      where.initiator = { contains: initiator }
    }

    if (startDate) {
      where.createdAt = { gte: new Date(startDate) }
    }

    if (endDate) {
      if (!where.createdAt) where.createdAt = {}
      where.createdAt.lte = new Date(endDate)
    }

    const [promotions, total] = await Promise.all([
      prisma.promotionRecord.findMany({
        where,
        include: {
          artifactVersion: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.promotionRecord.count({ where })
    ])

    return {
      data: promotions.map(p => this.formatPromotionDetail(p as any)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }

  async startPromotion(promotionId: string, operator: string) {
    const promotion = await prisma.promotionRecord.findUnique({
      where: { id: promotionId }
    })

    if (!promotion) {
      throw new Error('晋级记录不存在')
    }

    if (promotion.status !== PromotionStatus.DRAFT) {
      throw new Error('当前状态不允许启动')
    }

    const updated = await prisma.promotionRecord.update({
      where: { id: promotionId },
      data: {
        status: PromotionStatus.PENDING_TEST,
        currentStep: 1
      },
      include: {
        artifactVersion: true
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '启动晋级流程',
      actionType: 'STATUS_CHANGE',
      performedBy: operator,
      oldValue: { status: promotion.status },
      newValue: { status: PromotionStatus.PENDING_TEST }
    })

    return this.formatPromotionDetail(updated as any)
  }

  async cancelPromotion(promotionId: string, operator: string, reason: string) {
    const promotion = await prisma.promotionRecord.findUnique({
      where: { id: promotionId }
    })

    if (!promotion) {
      throw new Error('晋级记录不存在')
    }

    if ([PromotionStatus.PROMOTED, PromotionStatus.REJECTED, PromotionStatus.CANCELLED].includes(promotion.status)) {
      throw new Error('当前状态不允许取消')
    }

    const updated = await prisma.promotionRecord.update({
      where: { id: promotionId },
      data: {
        status: PromotionStatus.CANCELLED
      },
      include: {
        artifactVersion: true
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '取消晋级流程',
      actionType: 'STATUS_CHANGE',
      performedBy: operator,
      oldValue: { status: promotion.status },
      newValue: { status: PromotionStatus.CANCELLED, reason }
    })

    return this.formatPromotionDetail(updated as any)
  }

  private formatPromotionDetail(promotion: any): PromotionDetail {
    const artifact = promotion.artifactVersion
    const progress = Math.round((promotion.currentStep / promotion.totalSteps) * 100)

    return {
      id: promotion.id,
      artifactName: artifact?.artifactName || '',
      version: artifact?.version || '',
      buildNumber: artifact?.buildNumber || undefined,
      fromEnvironment: promotion.fromEnvironment,
      toEnvironment: promotion.toEnvironment,
      status: promotion.status,
      title: promotion.title,
      description: promotion.description || undefined,
      initiator: promotion.initiator,
      currentStep: promotion.currentStep,
      totalSteps: promotion.totalSteps,
      progress,
      testSummary: promotion.testSummary,
      signature: promotion.signature,
      approvals: promotion.approvals || [],
      corrections: promotion.corrections || [],
      exceptions: promotion.exceptions || [],
      auditLogs: promotion.auditLogs || [],
      createdAt: promotion.createdAt.toISOString(),
      updatedAt: promotion.updatedAt.toISOString(),
      completedAt: promotion.completedAt?.toISOString()
    }
  }
}

export const promotionService = new PromotionService()
