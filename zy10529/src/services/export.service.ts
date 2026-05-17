import prisma from '../lib/prisma'
import { PromotionReportData } from '../types'
import { createAuditLog } from './audit.service'
import { Parser } from 'json2csv'
import * as PDFDocument from 'pdfkit'

const ENVIRONMENT_MAP: Record<string, string> = {
  DEV: '开发环境',
  TEST: '测试环境',
  STAGING: '预发布环境',
  PRODUCTION: '生产环境'
}

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_TEST: '待测试',
  TEST_COMPLETED: '测试完成',
  PENDING_SIGNATURE: '待签名',
  SIGNED: '已签名',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已审批',
  PROMOTED: '已晋级',
  REJECTED: '已驳回',
  FAILED: '失败',
  CANCELLED: '已取消'
}

const TEST_RESULT_MAP: Record<string, string> = {
  PASS: '通过',
  FAIL: '失败',
  PARTIAL: '部分通过',
  NOT_RUN: '未运行'
}

const SIGNATURE_STATUS_MAP: Record<string, string> = {
  NOT_SIGNED: '未签名',
  PENDING: '待验证',
  VERIFIED: '已验证',
  INVALID: '无效'
}

const APPROVAL_DECISION_MAP: Record<string, string> = {
  APPROVE: '同意',
  REJECT: '驳回',
  DEFER: '暂缓'
}

export class ExportService {
  async generateReportData(promotionId: string): Promise<PromotionReportData> {
    const promotion = await prisma.promotionRecord.findUnique({
      where: { id: promotionId },
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
        }
      }
    })

    if (!promotion) {
      throw new Error('晋级记录不存在')
    }

    const artifact = promotion.artifactVersion
    const test = promotion.testSummary
    const signature = promotion.signature

    const passRate = test && test.totalTests > 0
      ? ((test.passedTests / test.totalTests) * 100).toFixed(1) + '%'
      : 'N/A'

    return {
      基本信息: {
        晋级标题: promotion.title,
        晋级描述: promotion.description || '',
        发起人员: promotion.initiator,
        创建时间: this.formatDate(promotion.createdAt),
        完成时间: promotion.completedAt ? this.formatDate(promotion.completedAt) : ''
      },
      制品信息: {
        制品名称: artifact.artifactName,
        版本号: artifact.version,
        构建编号: artifact.buildNumber || '',
        代码提交号: artifact.commitHash || '',
        构建分支: artifact.buildBranch || '',
        构建时间: artifact.buildTime ? this.formatDate(artifact.buildTime) : '',
        制品地址: artifact.artifactUrl || '',
        校验和: artifact.checksum || '',
        校验算法: artifact.checksumAlgorithm || ''
      },
      环境信息: {
        源环境: ENVIRONMENT_MAP[promotion.fromEnvironment] || promotion.fromEnvironment,
        目标环境: ENVIRONMENT_MAP[promotion.toEnvironment] || promotion.toEnvironment
      },
      测试结果: {
        测试套件: test?.testSuite || '',
        测试结果: test ? (TEST_RESULT_MAP[test.testResult] || test.testResult) : '',
        测试通过率: passRate,
        是否通过门禁: test?.gatePassed ? '是' : '否',
        总用例数: test?.totalTests || 0,
        通过数: test?.passedTests || 0,
        失败数: test?.failedTests || 0,
        跳过数: test?.skippedTests || 0,
        测试时长: test?.testDuration ? `${test.testDuration}秒` : '',
        测试报告: test?.testReportUrl || '',
        覆盖率: test?.coveragePercent !== null ? `${test.coveragePercent}%` : '',
        关键问题: test?.criticalIssues
          ? (Array.isArray(test.criticalIssues) ? test.criticalIssues.join(', ') : JSON.stringify(test.criticalIssues))
          : '',
        验证人员: test?.verifiedBy || '',
        验证时间: test?.verifiedAt ? this.formatDate(test.verifiedAt) : '',
        备注: test?.remarks || ''
      },
      签名信息: {
        签名状态: signature ? (SIGNATURE_STATUS_MAP[signature.signatureStatus] || signature.signatureStatus) : '未签名',
        签名人员: signature?.signatory || '',
        签名时间: signature?.signedAt ? this.formatDate(signature.signedAt) : '',
        签名算法: signature?.signatureAlgorithm || '',
        证书信息: signature?.certificateInfo || '',
        备注: signature?.remarks || ''
      },
      审批记录: promotion.approvals.map(approval => ({
        审批顺序: approval.sequenceOrder,
        审批人员: approval.approver,
        审批角色: approval.approverRole || '',
        审批结果: APPROVAL_DECISION_MAP[approval.decision] || approval.decision,
        审批意见: approval.comments || '',
        审批时间: approval.approvedAt ? this.formatDate(approval.approvedAt) : ''
      })),
      人工修正: promotion.corrections.map(correction => ({
        修正类型: correction.correctionType,
        字段名称: correction.fieldName,
        修正原因: correction.reason,
        修正人员: correction.correctedBy,
        修正时间: this.formatDate(correction.correctionTime),
        是否需要审批: correction.approvalRequired ? '是' : '否',
        审批人员: correction.approvedBy || '',
        审批时间: correction.approvedAt ? this.formatDate(correction.approvedAt) : ''
      })),
      异常记录: promotion.exceptions.map(exception => ({
        异常类型: exception.exceptionType,
        错误代码: exception.errorCode,
        错误信息: exception.errorMessage,
        处理状态: exception.resolutionStatus,
        创建时间: this.formatDate(exception.createdAt),
        解决人员: exception.resolvedBy || '',
        解决备注: exception.resolutionNotes || '',
        解决时间: exception.resolvedAt ? this.formatDate(exception.resolvedAt) : ''
      }))
    }
  }

  async exportToJson(promotionId: string, operator: string): Promise<string> {
    const reportData = await this.generateReportData(promotionId)

    await prisma.promotionReport.create({
      data: {
        promotionRecordId: promotionId,
        reportContent: reportData as any,
        reportFormat: 'JSON',
        generatedBy: operator,
        generatedAt: new Date()
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '导出JSON报告',
      actionType: 'EXPORT',
      performedBy: operator
    })

    return JSON.stringify(reportData, null, 2)
  }

  async exportToCsv(promotionId: string, operator: string): Promise<string> {
    const reportData = await this.generateReportData(promotionId)

    const flatData: Record<string, any> = {}

    Object.entries(reportData.基本信息).forEach(([key, value]) => {
      flatData[`基本信息_${key}`] = value
    })
    Object.entries(reportData.制品信息).forEach(([key, value]) => {
      flatData[`制品信息_${key}`] = value
    })
    Object.entries(reportData.环境信息).forEach(([key, value]) => {
      flatData[`环境信息_${key}`] = value
    })
    Object.entries(reportData.测试结果).forEach(([key, value]) => {
      flatData[`测试结果_${key}`] = value
    })
    Object.entries(reportData.签名信息).forEach(([key, value]) => {
      flatData[`签名信息_${key}`] = value
    })

    flatData['审批记录_数量'] = reportData.审批记录.length
    flatData['人工修正_数量'] = reportData.人工修正.length
    flatData['异常记录_数量'] = reportData.异常记录.length

    const parser = new Parser()
    const csv = parser.parse([flatData])

    await prisma.promotionReport.create({
      data: {
        promotionRecordId: promotionId,
        reportContent: flatData as any,
        reportFormat: 'CSV',
        generatedBy: operator,
        generatedAt: new Date()
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '导出CSV报告',
      actionType: 'EXPORT',
      performedBy: operator
    })

    return csv
  }

  async exportToPdf(promotionId: string, operator: string): Promise<Buffer> {
    const reportData = await this.generateReportData(promotionId)

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    })

    const buffers: Buffer[] = []
    doc.on('data', buffers.push.bind(buffers))

    doc.fontSize(20).text('制品晋级审批报告', { align: 'center' })
    doc.moveDown()

    doc.fontSize(14).text('一、基本信息', { underline: true })
    doc.moveDown(0.5)
    this.printKeyValue(doc, reportData.基本信息)
    doc.moveDown()

    doc.fontSize(14).text('二、制品信息', { underline: true })
    doc.moveDown(0.5)
    this.printKeyValue(doc, reportData.制品信息)
    doc.moveDown()

    doc.fontSize(14).text('三、环境信息', { underline: true })
    doc.moveDown(0.5)
    this.printKeyValue(doc, reportData.环境信息)
    doc.moveDown()

    doc.fontSize(14).text('四、测试结果', { underline: true })
    doc.moveDown(0.5)
    this.printKeyValue(doc, reportData.测试结果)
    doc.moveDown()

    doc.fontSize(14).text('五、签名信息', { underline: true })
    doc.moveDown(0.5)
    this.printKeyValue(doc, reportData.签名信息)
    doc.moveDown()

    if (reportData.审批记录.length > 0) {
      doc.fontSize(14).text('六、审批记录', { underline: true })
      doc.moveDown(0.5)
      reportData.审批记录.forEach((approval, index) => {
        doc.fontSize(11).text(`第${index + 1}条审批:`)
        this.printKeyValue(doc, approval, 10)
        doc.moveDown(0.3)
      })
    }

    doc.end()

    await new Promise(resolve => {
      doc.on('end', resolve)
    })

    await prisma.promotionReport.create({
      data: {
        promotionRecordId: promotionId,
        reportContent: reportData as any,
        reportFormat: 'PDF',
        generatedBy: operator,
        generatedAt: new Date()
      }
    })

    await createAuditLog({
      promotionRecordId: promotionId,
      action: '导出PDF报告',
      actionType: 'EXPORT',
      performedBy: operator
    })

    return Buffer.concat(buffers)
  }

  private printKeyValue(doc: any, obj: Record<string, any>, fontSize: number = 11) {
    doc.fontSize(fontSize)
    Object.entries(obj).forEach(([key, value]) => {
      if (value) {
        doc.text(`${key}: ${value}`)
      }
    })
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  async getExportHistory(promotionId: string) {
    return prisma.promotionReport.findMany({
      where: { promotionRecordId: promotionId },
      orderBy: { createdAt: 'desc' }
    })
  }
}

export const exportService = new ExportService()
