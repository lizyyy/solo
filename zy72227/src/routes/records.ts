import { Router, Request, Response } from 'express';
import { workflowService } from '../services/WorkflowService';
import { unifiedDataService } from '../services/UnifiedDataService';
import { conflictDetectionService } from '../services/ConflictDetectionService';
import { selfCheckService } from '../services/SelfCheckService';
import {
  ImportEmailRequest,
  SupplyBatchRequest,
  ResolveConflictRequest,
  SupervisorReviewRequest,
  ApiResponse
} from '../types';

const router = Router();

const handleAsync = (fn: any) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch(err => {
    res.status(500).json({ success: false, error: err.message });
  });
};

router.post('/import', handleAsync(async (req: Request, res: Response) => {
  const request = req.body as ImportEmailRequest;

  if (!request.emailSource || !request.emailContent || !request.businessNo || !request.lines || !request.importedBy) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：emailSource, emailContent, businessNo, lines, importedBy'
    } as ApiResponse<null>);
  }

  const record = await workflowService.step1_importManagerEmail(request);
  const view = unifiedDataService.getApiResponse(record.id);

  res.json({
    success: true,
    data: {
      record,
      unifiedView: view,
      workflowSummary: workflowService.getWorkflowSummary(record.id),
      nextStep: workflowService.canProceedToNextStep(record.id)
    },
    message: '第一步：客户经理补充邮件导入成功'
  } as ApiResponse<any>);
}));

router.get('/:id', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const view = unifiedDataService.getPageView(id);

  if (!view) {
    return res.status(404).json({
      success: false,
      error: '记录不存在'
    } as ApiResponse<null>);
  }

  const rawRecord = unifiedDataService.getRawRecord(id);

  res.json({
    success: true,
    data: {
      unifiedView: view,
      rawRecord,
      workflowSummary: workflowService.getWorkflowSummary(id),
      nextStep: workflowService.canProceedToNextStep(id),
      unresolvedConflicts: conflictDetectionService.getUnresolvedConflicts(id),
      selfCheckIssues: rawRecord?.selfCheckIssues || [],
      consistencyCheck: unifiedDataService.verifyConsistency(id)
    }
  } as ApiResponse<any>);
}));

router.get('/', handleAsync(async (req: Request, res: Response) => {
  const records = unifiedDataService.getAllRecords();
  const views = records.map(r => unifiedDataService.getPageView(r.id)).filter(Boolean);

  res.json({
    success: true,
    data: views,
    total: views.length
  } as ApiResponse<any>);
}));

router.post('/:id/supply-batch', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { settlementBatchNo, suppliedBy } = req.body;

  if (!settlementBatchNo || !suppliedBy) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：settlementBatchNo, suppliedBy'
    } as ApiResponse<null>);
  }

  const request: SupplyBatchRequest = {
    recordId: id,
    settlementBatchNo,
    suppliedBy
  };

  try {
    const record = await workflowService.step2_supplySettlementBatch(request);
    const view = unifiedDataService.getApiResponse(id);

    res.json({
      success: true,
      data: {
        record,
        unifiedView: view,
        workflowSummary: workflowService.getWorkflowSummary(id),
        nextStep: workflowService.canProceedToNextStep(id),
        consistencyCheck: unifiedDataService.verifyConsistency(id)
      },
      message: '第二步：对账运营阿芬补录清算批次号成功'
    } as ApiResponse<any>);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    } as ApiResponse<null>);
  }
}));

router.post('/:id/resolve-conflict', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { conflictId, resolution, resolvedBy } = req.body;

  if (!conflictId || !resolution || !resolvedBy) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：conflictId, resolution, resolvedBy'
    } as ApiResponse<null>);
  }

  if (!['CONFIRM_EMAIL', 'CONFIRM_BATCH', 'REJECT_BOTH'].includes(resolution)) {
    return res.status(400).json({
      success: false,
      error: 'resolution 必须是 CONFIRM_EMAIL, CONFIRM_BATCH, REJECT_BOTH 之一'
    } as ApiResponse<null>);
  }

  const request: ResolveConflictRequest = {
    recordId: id,
    conflictId,
    resolution,
    resolvedBy
  };

  try {
    const record = await workflowService.resolveConflict(request);
    const view = unifiedDataService.getApiResponse(id);
    const unresolvedConflicts = conflictDetectionService.getUnresolvedConflicts(id);

    res.json({
      success: true,
      data: {
        record,
        unifiedView: view,
        unresolvedConflicts,
        workflowSummary: workflowService.getWorkflowSummary(id),
        nextStep: workflowService.canProceedToNextStep(id)
      },
      message: `冲突已${resolution === 'REJECT_BOTH' ? '驳回' : '确认'}，请对账运营阿芬查看处理结果`
    } as ApiResponse<any>);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    } as ApiResponse<null>);
  }
}));

router.post('/:id/supervisor-review', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { reviewedBy, approved, reviewComment } = req.body;

  if (!reviewedBy || approved === undefined) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：reviewedBy, approved'
    } as ApiResponse<null>);
  }

  const request: SupervisorReviewRequest = {
    recordId: id,
    reviewedBy,
    approved,
    reviewComment
  };

  try {
    const record = await workflowService.supervisorReview(request);
    const view = unifiedDataService.getApiResponse(id);

    res.json({
      success: true,
      data: {
        record,
        unifiedView: view,
        workflowSummary: workflowService.getWorkflowSummary(id),
        nextStep: workflowService.canProceedToNextStep(id)
      },
      message: approved
        ? '拆分行记录已通过结算主管复核，可进入下一步'
        : '拆分行记录未通过结算主管复核，请重新核对'
    } as ApiResponse<any>);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    } as ApiResponse<null>);
  }
}));

router.post('/:id/update-diff', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { operator } = req.body;

  if (!operator) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：operator'
    } as ApiResponse<null>);
  }

  try {
    const record = await workflowService.step3_updateDiffList(id, operator);
    const view = unifiedDataService.getApiResponse(id);

    res.json({
      success: true,
      data: {
        record,
        unifiedView: view,
        workflowSummary: workflowService.getWorkflowSummary(id),
        nextStep: workflowService.canProceedToNextStep(id),
        consistencyCheck: unifiedDataService.verifyConsistency(id)
      },
      message: '第三步：差异清单更新成功'
    } as ApiResponse<any>);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    } as ApiResponse<null>);
  }
}));

router.post('/:id/complete', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { operator } = req.body;

  if (!operator) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：operator'
    } as ApiResponse<null>);
  }

  try {
    const record = await workflowService.completeRecord(id, operator);
    const view = unifiedDataService.getApiResponse(id);

    res.json({
      success: true,
      data: {
        record,
        unifiedView: view,
        workflowSummary: workflowService.getWorkflowSummary(id),
        consistencyCheck: unifiedDataService.verifyConsistency(id)
      },
      message: '养老目标基金换仓记录流程已完成'
    } as ApiResponse<any>);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    } as ApiResponse<null>);
  }
}));

router.get('/:id/export', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const format = req.query.format as string || 'csv';

  const view = unifiedDataService.getApiResponse(id);
  if (!view) {
    return res.status(404).json({
      success: false,
      error: '记录不存在'
    } as ApiResponse<null>);
  }

  const consistency = unifiedDataService.verifyConsistency(id);
  if (!consistency.consistent) {
    return res.status(500).json({
      success: false,
      error: '数据一致性校验失败，导出已阻止。页面、接口、明细三方数据不一致，请先修复问题'
    } as ApiResponse<null>);
  }

  if (format === 'csv') {
    const csv = unifiedDataService.generateCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="养老目标基金换仓记录_${view.record.businessNo}.csv"`);
    res.send('\uFEFF' + csv);
  } else if (format === 'json') {
    const exportLines = unifiedDataService.getExportLines(id);
    res.json({
      success: true,
      data: {
        exportLines,
        summary: view,
        consistencyCheck: consistency,
        calculationTraces: view.record.lines.map(l => ({
          lineId: l.id,
          lineType: l.lineType,
          paramsVersion: l.calculationTrace.paramsVersion,
          decisionReason: l.calculationTrace.decisionReason,
          calculatedAt: l.calculationTrace.calculatedAt,
          calculatedBy: l.calculationTrace.calculatedBy
        }))
      }
    } as ApiResponse<any>);
  } else {
    res.status(400).json({
      success: false,
      error: '不支持的导出格式，请使用 csv 或 json'
    } as ApiResponse<null>);
  }
}));

router.post('/:id/self-check', handleAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const issues = selfCheckService.runAllChecks(id);
  const view = unifiedDataService.getApiResponse(id);

  res.json({
    success: true,
    data: {
      issues,
      unifiedView: view,
      failedChecks: selfCheckService.getFailedChecks(id)
    },
    message: `自检完成，共 ${issues.length} 项检查，失败 ${selfCheckService.getFailedChecks(id).length} 项`
  } as ApiResponse<any>);
}));

export default router;
