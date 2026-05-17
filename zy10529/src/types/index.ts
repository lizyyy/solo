import {
  EnvironmentStage,
  PromotionStatus,
  SignatureStatus,
  ApprovalDecision,
  TestResult
} from '@prisma/client'

export interface CreatePromotionRequest {
  artifactName: string
  version: string
  buildNumber?: string
  commitHash?: string
  buildBranch?: string
  buildTime?: string
  artifactUrl?: string
  checksum?: string
  checksumAlgorithm?: string
  fromEnvironment: EnvironmentStage
  toEnvironment: EnvironmentStage
  title: string
  description?: string
  initiator: string
  metadata?: Record<string, any>
}

export interface SubmitTestResultRequest {
  promotionId: string
  testSuite: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  testResult: TestResult
  testDuration?: number
  testStartTime?: string
  testEndTime?: string
  testReportUrl?: string
  coveragePercent?: number
  criticalIssues?: any[]
  gatePassed: boolean
  remarks?: string
  verifiedBy: string
}

export interface SubmitSignatureRequest {
  promotionId: string
  signatory: string
  signatureData: string
  signatureAlgorithm: string
  certificateInfo?: string
  remarks?: string
}

export interface SubmitApprovalRequest {
  promotionId: string
  approver: string
  approverRole?: string
  decision: ApprovalDecision
  comments?: string
  sequenceOrder?: number
}

export interface ManualCorrectionRequest {
  promotionId: string
  correctionType: string
  fieldName: string
  oldValue: any
  newValue: any
  reason: string
  correctedBy: string
  approvalRequired?: boolean
}

export interface PromotionDetail {
  id: string
  artifactName: string
  version: string
  buildNumber?: string
  fromEnvironment: EnvironmentStage
  toEnvironment: EnvironmentStage
  status: PromotionStatus
  title: string
  description?: string
  initiator: string
  currentStep: number
  totalSteps: number
  progress: number
  testSummary?: any
  signature?: any
  approvals: any[]
  corrections: any[]
  exceptions: any[]
  auditLogs: any[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface PromotionQueryParams {
  artifactName?: string
  version?: string
  fromEnvironment?: EnvironmentStage
  toEnvironment?: EnvironmentStage
  status?: PromotionStatus
  initiator?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface PromotionReportData {
  基本信息: {
    晋级标题: string
    晋级描述?: string
    发起人员: string
    创建时间: string
    完成时间?: string
  }
  制品信息: {
    制品名称: string
    版本号: string
    构建编号?: string
    代码提交号?: string
    构建分支?: string
    构建时间?: string
    制品地址?: string
    校验和?: string
    校验算法?: string
  }
  环境信息: {
    源环境: string
    目标环境: string
  }
  测试结果: {
    测试套件: string
    测试结果: string
    测试通过率: string
    是否通过门禁: string
    总用例数: number
    通过数: number
    失败数: number
    跳过数: number
    测试时长?: string
    测试报告?: string
    覆盖率?: string
    关键问题?: string
    验证人员?: string
    验证时间?: string
    备注?: string
  }
  签名信息: {
    签名状态: string
    签名人员: string
    签名时间?: string
    签名算法: string
    证书信息?: string
    备注?: string
  }
  审批记录: Array<{
    审批顺序: number
    审批人员: string
    审批角色?: string
    审批结果: string
    审批意见?: string
    审批时间?: string
  }>
  人工修正: Array<{
    修正类型: string
    字段名称: string
    修正原因: string
    修正人员: string
    修正时间: string
    是否需要审批: string
    审批人员?: string
    审批时间?: string
  }>
  异常记录: Array<{
    异常类型: string
    错误代码: string
    错误信息: string
    处理状态: string
    创建时间: string
    解决人员?: string
    解决备注?: string
    解决时间?: string
  }>
}
