import prisma from '../lib/prisma'
import { SubmitTestResultRequest } from '../types'
import { PromotionStatus, TestResult } from '@prisma/client'
import { createAuditLog, createExceptionRecord } from './audit.service'
import { promotionService } from './promotion.service'

export class TestService {
  async submitTestResult(request: SubmitTestResultRequest, operator: string) {
    try {
      const promotion = await prisma.promotionRecord.findUnique({
        where: { id: request.promotionId },
        include: { testSummary: true }
      })

      if (!promotion) {
        throw new Error('晋级记录不存在')
      }

      if (promotion.status !== PromotionStatus.PENDING_TEST) {
        throw new Error('当前状态不允许提交测试结果')
      }

      const oldStatus = promotion.status

      if (promotion.testSummary) {
        await prisma.testSummary.delete({
          where: { id: promotion.testSummary.id }
        })
      }

      const testSummary = await prisma.testSummary.create({
        data: {
          promotionRecordId: request.promotionId,
          testSuite: request.testSuite,
          totalTests: request.totalTests,
          passedTests: request.passedTests,
          failedTests: request.failedTests,
          skippedTests: request.skippedTests,
          testResult: request.testResult,
          testDuration: request.testDuration,
          testStartTime: request.testStartTime ? new Date(request.testStartTime) : null,
          testEndTime: request.testEndTime ? new Date(request.testEndTime) : null,
          testReportUrl: request.testReportUrl,
          coveragePercent: request.coveragePercent,
          criticalIssues: request.criticalIssues,
          gatePassed: request.gatePassed,
          remarks: request.remarks,
          verifiedBy: request.verifiedBy,
          verifiedAt: new Date()
        }
      })

      let newStatus = PromotionStatus.TEST_COMPLETED
      let newStep = 2

      if (!request.gatePassed) {
        newStatus = PromotionStatus.FAILED
        newStep = promotion.currentStep
      }

      const updatedPromotion = await prisma.promotionRecord.update({
        where: { id: request.promotionId },
        data: {
          status: newStatus,
          currentStep: newStep,
          testSummaryId: testSummary.id
        },
        include: {
          artifactVersion: true,
          testSummary: true
        }
      })

      await createAuditLog({
        promotionRecordId: request.promotionId,
        action: '提交测试结果',
        actionType: 'TEST_RESULT',
        performedBy: operator,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, gatePassed: request.gatePassed }
      })

      return promotionService.formatPromotionDetail(updatedPromotion as any)
    } catch (error: any) {
      await createExceptionRecord({
        promotionId: request.promotionId,
        exceptionType: 'SUBMIT_TEST_RESULT_ERROR',
        errorCode: 'E002',
        errorMessage: error.message,
        stackTrace: error.stack,
        rawInput: request as any,
        processingContext: { operator }
      })
      throw error
    }
  }

  async checkTestGate(promotionId: string): Promise<{
    passed: boolean
    reasons: string[]
  }> {
    const testSummary = await prisma.testSummary.findFirst({
      where: { promotionRecordId: promotionId }
    })

    if (!testSummary) {
      return { passed: false, reasons: ['未找到测试结果'] }
    }

    const reasons: string[] = []

    const passRate = testSummary.totalTests > 0
      ? (testSummary.passedTests / testSummary.totalTests) * 100
      : 0

    if (passRate < 90) {
      reasons.push(`测试通过率${passRate.toFixed(1)}%，低于90%要求`)
    }

    if (testSummary.coveragePercent !== null && testSummary.coveragePercent < 80) {
      reasons.push(`测试覆盖率${testSummary.coveragePercent}%，低于80%要求`)
    }

    if (testSummary.criticalIssues && (testSummary.criticalIssues as any[]).length > 0) {
      reasons.push(`存在${(testSummary.criticalIssues as any[]).length}个严重问题`)
    }

    return {
      passed: reasons.length === 0,
      reasons
    }
  }

  async getTestSummary(promotionId: string) {
    return prisma.testSummary.findFirst({
      where: { promotionRecordId: promotionId }
    })
  }
}

export const testService = new TestService()
