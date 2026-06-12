import { Router, Request, Response } from 'express';
import { shelterDao } from '../dao/shelterDao';
import { conflictDetectionService } from '../services/conflictDetectionService';
import { selfCheckService } from '../services/selfCheckService';
import { capacityCheckService } from '../services/capacityCheckService';
import { workflowService } from '../services/workflowService';
import { unifiedDataLayer } from '../services/unifiedDataLayer';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/shelters', (req: Request, res: Response) => {
  const shelters = shelterDao.findAll();
  res.json(shelters);
});

router.get('/shelters/:id', (req: Request, res: Response) => {
  const shelter = shelterDao.findById(req.params.id);
  if (!shelter) {
    return res.status(404).json({ error: '避难点不存在' });
  }
  res.json(shelter);
});

router.post('/shelters', (req: Request, res: Response) => {
  const shelter = shelterDao.create(req.body);
  res.status(201).json(shelter);
});

router.get('/capacity-checks', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getCapacityCheckResults();
  res.json(result);
});

router.get('/capacity-checks/:shelterId', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getCapacityCheckDetailForShelter(req.params.shelterId);
  res.json(result);
});

router.post('/capacity-checks/calculate', (req: Request, res: Response) => {
  const { checkedBy } = req.body;
  const results = capacityCheckService.calculateAll(checkedBy || 'system');
  res.json(results);
});

router.post('/capacity-checks/:shelterId/recalculate', (req: Request, res: Response) => {
  const { checkedBy } = req.body;
  const result = capacityCheckService.recalculateAfterSupplement(req.params.shelterId, checkedBy || 'system');
  if (!result) {
    return res.status(404).json({ error: '避难点不存在' });
  }
  res.json(result);
});

router.get('/params', (req: Request, res: Response) => {
  const params = capacityCheckService.getActiveParams();
  res.json(params);
});

router.get('/conflicts', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getConflictRecords();
  res.json(result);
});

router.get('/conflicts/pending', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getPendingConflicts();
  res.json(result);
});

router.post('/conflicts/detect', (req: Request, res: Response) => {
  const conflicts = conflictDetectionService.detectAllConflicts();
  res.json(conflicts);
});

router.post('/conflicts/:id/confirm', (req: Request, res: Response) => {
  const { resolvedBy, resolutionNote } = req.body;
  conflictDetectionService.confirmConflict(req.params.id, resolvedBy || '老马', resolutionNote || '');
  res.json({ success: true });
});

router.post('/conflicts/:id/reject', (req: Request, res: Response) => {
  const { resolvedBy, resolutionNote } = req.body;
  conflictDetectionService.rejectConflict(req.params.id, resolvedBy || '老马', resolutionNote || '');
  res.json({ success: true });
});

router.get('/self-checks', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getSelfCheckResults();
  res.json(result);
});

router.post('/self-checks/run', (req: Request, res: Response) => {
  const results = selfCheckService.runAllChecks();
  res.json(results);
});

router.get('/consistency/verify', (req: Request, res: Response) => {
  const result = unifiedDataLayer.verifyConsistency();
  res.json(result);
});

router.get('/workflows', (req: Request, res: Response) => {
  const workflows = workflowService.getAllWorkflows();
  res.json(workflows);
});

router.get('/workflows/shelter/:shelterId', (req: Request, res: Response) => {
  const workflow = workflowService.getWorkflowForShelter(req.params.shelterId);
  res.json(workflow);
});

router.post('/workflows/start', (req: Request, res: Response) => {
  const { shelterId, operator } = req.body;
  const workflow = workflowService.startWorkflow(shelterId, operator || '系统');
  if (!workflow) {
    return res.status(404).json({ error: '避难点不存在' });
  }
  res.json(workflow);
});

router.post('/workflows/step1', (req: Request, res: Response) => {
  const { workflowId, shelterId, version, remarks, areaRange, effectiveDate, importOperator } = req.body;
  const result = workflowService.step1_importRedLine(
    workflowId, shelterId, version, remarks, areaRange, effectiveDate, importOperator || '操作员'
  );
  if (!result) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.post('/workflows/step2', (req: Request, res: Response) => {
  const { workflowId, shelterId, inspectorName, inspectionDate, actualCapacity, foundIssues, isTemporaryDetour, detourDescription, roadCondition, operator } = req.body;
  const result = workflowService.step2_reviewInspectorReport(
    workflowId, shelterId, inspectorName || '网格员', inspectionDate, actualCapacity,
    foundIssues || '', isTemporaryDetour || false, detourDescription || '',
    roadCondition || 'normal', operator || '老马'
  );
  if (!result) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.post('/workflows/resume', (req: Request, res: Response) => {
  const { workflowId, shelterId, operator } = req.body;
  const result = workflowService.resumeAfterResidentReview(workflowId, shelterId, operator || '居民代表');
  if (!result) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.post('/workflows/step3', (req: Request, res: Response) => {
  const { workflowId, shelterId, operator } = req.body;
  const result = workflowService.step3_updatePointList(workflowId, shelterId, operator || '系统');
  if (!result) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.get('/redlines', (req: Request, res: Response) => {
  const { shelterId, batchNo } = req.query;
  const result = unifiedDataLayer.getRedLineMaps(
    shelterId as string | undefined,
    batchNo as string | undefined
  );
  res.json(result);
});

router.get('/redlines/:id', (req: Request, res: Response) => {
  const { redLineDao } = require('../dao/redLineDao');
  const redLine = redLineDao.findById(req.params.id);
  if (!redLine) {
    return res.status(404).json({ error: '红线图不存在' });
  }
  res.json(redLine);
});

router.post('/redlines/:id/review', (req: Request, res: Response) => {
  const { reviewStatus, reviewNote, reviewedBy } = req.body;
  const result = workflowService.reviewRedLine(
    req.params.id,
    reviewStatus || 'reviewed',
    reviewNote || '',
    reviewedBy || '老马'
  );
  if (!result) {
    return res.status(404).json({ error: '红线图不存在' });
  }
  res.json(result);
});

router.put('/redlines/:id/remarks', (req: Request, res: Response) => {
  const { remarks, operator } = req.body;
  const result = workflowService.updateRedLineRemarks(
    req.params.id,
    remarks || '',
    operator || '操作员'
  );
  if (!result) {
    return res.status(404).json({ error: '红线图不存在' });
  }
  res.json(result);
});

router.post('/redlines/reimport', (req: Request, res: Response) => {
  const { workflowId, shelterId, version, remarks, areaRange, effectiveDate, importOperator, reimportNote, prevVersionId } = req.body;
  const result = workflowService.step1_importRedLine(
    workflowId, shelterId, version, remarks, areaRange, effectiveDate,
    importOperator || '操作员',
    { isReimport: true, reimportNote: reimportNote || '', prevVersionId }
  );
  if (!result.workflow) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.get('/batches', (req: Request, res: Response) => {
  const batches = unifiedDataLayer.getAllBatches();
  res.json(batches);
});

router.get('/change-history', (req: Request, res: Response) => {
  const { shelterId } = req.query;
  const result = unifiedDataLayer.getChangeHistory(shelterId as string | undefined);
  res.json(result);
});

router.get('/detour-records', (req: Request, res: Response) => {
  const result = unifiedDataLayer.getDetourAffectedResults();
  res.json(result);
});

router.get('/workflows/all/:shelterId', (req: Request, res: Response) => {
  const workflows = workflowService.getAllWorkflowsForShelter(req.params.shelterId);
  res.json(workflows);
});

router.post('/inspector-reports', (req: Request, res: Response) => {
  const { shelterId, inspectorName, inspectionDate, actualCapacity, foundIssues, isTemporaryDetour, detourDescription, roadCondition, workflowId, operator } = req.body;
  if (workflowId) {
    const result = workflowService.step2_reviewInspectorReport(
      workflowId, shelterId,
      inspectorName || '网格员', inspectionDate, actualCapacity,
      foundIssues || '', isTemporaryDetour || false, detourDescription || '',
      roadCondition || 'normal', operator || '老马'
    );
    res.json(result);
  } else {
    const { inspectorDao } = require('../dao/inspectorDao');
    const { generateReportNo, getCurrentTime } = require('../utils/common');
    const report = inspectorDao.create({
      reportNo: generateReportNo(),
      shelterId,
      inspectorName: inspectorName || '网格员',
      inspectionDate,
      actualCapacity,
      foundIssues: foundIssues || '',
      isTemporaryDetour: isTemporaryDetour || false,
      detourDescription: detourDescription || '',
      roadCondition: roadCondition || 'normal'
    });
    res.json(report);
  }
});

router.post('/point-update', (req: Request, res: Response) => {
  const { workflowId, shelterId, operator } = req.body;
  const result = workflowService.step3_updatePointList(
    workflowId, shelterId, operator || '系统'
  );
  if (!result.workflow) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.post('/resident-review', (req: Request, res: Response) => {
  const { workflowId, shelterId, operator } = req.body;
  const result = workflowService.resumeAfterResidentReview(
    workflowId, shelterId, operator || '居民代表'
  );
  if (!result) {
    return res.status(400).json({ error: '工作流状态不正确或不存在' });
  }
  res.json(result);
});

router.get('/exports/:type', (req: Request, res: Response) => {
  const type = req.params.type as 'detail' | 'summary' | 'self_check';
  if (!['detail', 'summary', 'self_check'].includes(type)) {
    return res.status(400).json({ error: '无效的导出类型' });
  }
  const { batchNo, includeDetourOnly } = req.query;
  const result = unifiedDataLayer.generateExportData(type, {
    batchNo: batchNo as string | undefined,
    includeDetourOnly: includeDetourOnly === 'true'
  });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="export_${type}_${Date.now()}.json"`);
  res.json(result);
});

export default router;
