import { Router, Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { promotionService } from '../services/promotion.service'
import { testService } from '../services/test.service'
import { signatureService } from '../services/signature.service'
import { approvalService } from '../services/approval.service'
import { correctionService } from '../services/correction.service'
import { exportService } from '../services/export.service'
import { getAuditLogs, getExceptionRecords, resolveException } from '../services/audit.service'

const router = Router()

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

const getOperator = (req: Request): string => {
  return req.headers['x-operator'] as string || 'system'
}

router.post('/',
  [
    body('artifactName').notEmpty().withMessage('制品名称不能为空'),
    body('version').notEmpty().withMessage('版本号不能为空'),
    body('fromEnvironment').isIn(['DEV', 'TEST', 'STAGING', 'PRODUCTION']).withMessage('无效的源环境'),
    body('toEnvironment').isIn(['DEV', 'TEST', 'STAGING', 'PRODUCTION']).withMessage('无效的目标环境'),
    body('title').notEmpty().withMessage('晋级标题不能为空'),
    body('initiator').notEmpty().withMessage('发起人员不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await promotionService.createPromotion(req.body, operator)
      res.status(201).json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await promotionService.getPromotionById(req.params.id)
      if (!result) {
        return res.status(404).json({ error: '晋级记录不存在' })
      }
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await promotionService.queryPromotions(req.query as any)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.post('/:id/start',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await promotionService.startPromotion(req.params.id, operator)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/:id/cancel',
  [
    param('id').isUUID().withMessage('无效的晋级ID'),
    body('reason').notEmpty().withMessage('取消原因不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await promotionService.cancelPromotion(req.params.id, operator, req.body.reason)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/test-result',
  [
    body('promotionId').isUUID().withMessage('无效的晋级ID'),
    body('testSuite').notEmpty().withMessage('测试套件不能为空'),
    body('totalTests').isInt({ min: 0 }).withMessage('总用例数不能为空'),
    body('passedTests').isInt({ min: 0 }).withMessage('通过数不能为空'),
    body('failedTests').isInt({ min: 0 }).withMessage('失败数不能为空'),
    body('skippedTests').isInt({ min: 0 }).withMessage('跳过数不能为空'),
    body('testResult').isIn(['PASS', 'FAIL', 'PARTIAL', 'NOT_RUN']).withMessage('无效的测试结果'),
    body('gatePassed').isBoolean().withMessage('门禁标识不能为空'),
    body('verifiedBy').notEmpty().withMessage('验证人员不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await testService.submitTestResult(req.body, operator)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.get('/:id/test-gate',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await testService.checkTestGate(req.params.id)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.post('/signature',
  [
    body('promotionId').isUUID().withMessage('无效的晋级ID'),
    body('signatory').notEmpty().withMessage('签名人员不能为空'),
    body('signatureData').notEmpty().withMessage('签名数据不能为空'),
    body('signatureAlgorithm').notEmpty().withMessage('签名算法不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await signatureService.submitSignature(req.body, operator)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/approval',
  [
    body('promotionId').isUUID().withMessage('无效的晋级ID'),
    body('approver').notEmpty().withMessage('审批人员不能为空'),
    body('decision').isIn(['APPROVE', 'REJECT', 'DEFER']).withMessage('无效的审批决策')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await approvalService.submitApproval(req.body, operator)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/:id/complete',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await approvalService.completePromotion(req.params.id, operator)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/correction',
  [
    body('promotionId').isUUID().withMessage('无效的晋级ID'),
    body('correctionType').notEmpty().withMessage('修正类型不能为空'),
    body('fieldName').notEmpty().withMessage('字段名称不能为空'),
    body('reason').notEmpty().withMessage('修正原因不能为空'),
    body('correctedBy').notEmpty().withMessage('修正人员不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await correctionService.createCorrection(req.body, operator)
      res.status(201).json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/correction/:id/approve',
  [
    param('id').isUUID().withMessage('无效的修正ID'),
    body('approvedBy').notEmpty().withMessage('审批人员不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await correctionService.approveCorrection(req.params.id, req.body.approvedBy)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.post('/exception/:id/resolve',
  [
    param('id').isUUID().withMessage('无效的异常ID'),
    body('resolvedBy').notEmpty().withMessage('解决人员不能为空'),
    body('resolutionNotes').notEmpty().withMessage('解决备注不能为空')
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await resolveException(req.params.id, req.body.resolvedBy, req.body.resolutionNotes)
      res.json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
)

router.get('/:id/audit-logs',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await getAuditLogs(req.params.id)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id/exceptions',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await getExceptionRecords(req.params.id)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id/export/json',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await exportService.exportToJson(req.params.id, operator)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="promotion-${req.params.id}.json"`)
      res.send(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id/export/csv',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await exportService.exportToCsv(req.params.id, operator)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="promotion-${req.params.id}.csv"`)
      res.send('\uFEFF' + result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id/export/pdf',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const operator = getOperator(req)
      const result = await exportService.exportToPdf(req.params.id, operator)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="promotion-${req.params.id}.pdf"`)
      res.send(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

router.get('/:id/export/history',
  [param('id').isUUID().withMessage('无效的晋级ID')],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await exportService.getExportHistory(req.params.id)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)

export default router
