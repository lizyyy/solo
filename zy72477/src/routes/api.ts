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

router.get('/exports/:type', (req: Request, res: Response) => {
  const type = req.params.type as 'detail' | 'summary' | 'self_check';
  if (!['detail', 'summary', 'self_check'].includes(type)) {
    return res.status(400).json({ error: '无效的导出类型' });
  }
  const result = unifiedDataLayer.generateExportData(type);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="export_${type}_${Date.now()}.json"`);
  res.json(result);
});

export default router;
