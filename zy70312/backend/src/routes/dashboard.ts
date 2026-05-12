import { Router, Request, Response } from 'express';
import { serviceDAO, endpointDAO, budgetRuleDAO, metricDAO, exceptionDAO, freezeDAO } from '../db/dao.js';
import { getOverview, getServiceDetail, getMetricsGaps, generateRiskList, cleanupExpiredExceptions } from '../services/dashboardService.js';
import { generateSampleData } from '../services/sampleData.js';

const router = Router();

router.get('/overview', (req: Request, res: Response) => {
  cleanupExpiredExceptions();
  const overview = getOverview();
  res.json(overview);
});

router.get('/services/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const detail = getServiceDetail(id);
  if (!detail) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json(detail);
});

router.get('/services', (req: Request, res: Response) => {
  const services = serviceDAO.getAll();
  res.json(services);
});

router.get('/endpoints', (req: Request, res: Response) => {
  const serviceId = req.query.serviceId as string | undefined;
  const endpoints = serviceId ? endpointDAO.getByService(serviceId) : endpointDAO.getAll();
  res.json(endpoints);
});

router.get('/budget-rules', (req: Request, res: Response) => {
  const serviceId = req.query.serviceId as string | undefined;
  const rules = serviceId ? budgetRuleDAO.getByService(serviceId) : budgetRuleDAO.getAllActive();
  res.json(rules);
});

router.get('/metrics-gaps', (req: Request, res: Response) => {
  const gaps = getMetricsGaps();
  res.json(gaps);
});

router.get('/risk-list', (req: Request, res: Response) => {
  const riskList = generateRiskList();
  res.json(riskList);
});

router.get('/freezes', (req: Request, res: Response) => {
  const serviceId = req.query.serviceId as string | undefined;
  const freezes = serviceId ? freezeDAO.getActiveByService(serviceId) : freezeDAO.getAll();
  res.json(freezes);
});

router.post('/freezes', (req: Request, res: Response) => {
  const { serviceId, endpointId, reason, reasonDetail, triggeredBy } = req.body;
  
  if (!serviceId || !reason || !reasonDetail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const existing = freezeDAO.getActiveByService(serviceId);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Service already has active freeze' });
  }
  
  const freeze = freezeDAO.create({
    serviceId,
    endpointId: endpointId || null,
    reason,
    reasonDetail,
    triggeredBy: triggeredBy || 'manual',
    isActive: true,
  });
  
  res.status(201).json(freeze);
});

router.post('/freezes/:id/lift', (req: Request, res: Response) => {
  const { id } = req.params;
  const { liftedBy } = req.body;
  
  const freeze = freezeDAO.getById(id);
  if (!freeze) {
    return res.status(404).json({ error: 'Freeze not found' });
  }
  
  if (!freeze.isActive) {
    return res.status(400).json({ error: 'Freeze already lifted' });
  }
  
  const updated = freezeDAO.lift(id, liftedBy || 'manual');
  res.json(updated);
});

router.get('/exceptions', (req: Request, res: Response) => {
  cleanupExpiredExceptions();
  const exceptions = exceptionDAO.getAll();
  res.json(exceptions);
});

router.post('/exceptions', (req: Request, res: Response) => {
  const { serviceId, endpointId, releaseId, reason, requestedBy, expiresInHours } = req.body;
  
  if (!serviceId || !releaseId || !reason || !requestedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const now = Date.now();
  const expiresAt = now + (expiresInHours || 4) * 60 * 60 * 1000;
  
  const exception = exceptionDAO.create({
    serviceId,
    endpointId: endpointId || null,
    releaseId,
    reason,
    requestedBy,
    approvedBy: null,
    status: 'pending',
    expiresAt,
  });
  
  res.status(201).json(exception);
});

router.post('/exceptions/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { approvedBy } = req.body;
  
  const exception = exceptionDAO.getById(id);
  if (!exception) {
    return res.status(404).json({ error: 'Exception not found' });
  }
  
  if (exception.status !== 'pending') {
    return res.status(400).json({ error: 'Exception not in pending status' });
  }
  
  const updated = exceptionDAO.updateStatus(id, 'approved', approvedBy || 'SRE');
  res.json(updated);
});

router.post('/exceptions/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const { approvedBy } = req.body;
  
  const exception = exceptionDAO.getById(id);
  if (!exception) {
    return res.status(404).json({ error: 'Exception not found' });
  }
  
  if (exception.status !== 'pending') {
    return res.status(400).json({ error: 'Exception not in pending status' });
  }
  
  const updated = exceptionDAO.updateStatus(id, 'rejected', approvedBy || 'SRE');
  res.json(updated);
});

router.post('/metrics', (req: Request, res: Response) => {
  const metrics = req.body;
  
  if (!Array.isArray(metrics)) {
    return res.status(400).json({ error: 'Metrics must be an array' });
  }
  
  const validMetrics = metrics.map((m: any) => ({
    serviceId: m.serviceId,
    endpointId: m.endpointId || null,
    timestamp: m.timestamp || Date.now(),
    totalRequests: m.totalRequests || 0,
    errorRequests: m.errorRequests || 0,
    p50LatencyMs: m.p50LatencyMs || 0,
    p99LatencyMs: m.p99LatencyMs || 0,
    source: m.source || 'api',
  }));
  
  metricDAO.insertBatch(validMetrics);
  res.status(201).json({ inserted: validMetrics.length });
});

router.get('/export/risk-list', (req: Request, res: Response) => {
  const riskList = generateRiskList();
  
  const csvContent = [
    ['服务名称', '接口', '状态', '发布决策', '剩余预算', '燃烧速度', '原因', '建议'].join(','),
    ...riskList.map(item => [
      item.serviceName,
      item.endpoint,
      item.status,
      item.decision,
      item.remainingBudget,
      item.burnRate,
      `"${item.reasons.join('; ')}"`,
      `"${item.recommendations.join('; ')}"`,
    ].join(','))
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=risk-list.csv');
  res.send('\uFEFF' + csvContent);
});

router.post('/sample-data', (req: Request, res: Response) => {
  generateSampleData();
  res.json({ success: true });
});

export default router;
