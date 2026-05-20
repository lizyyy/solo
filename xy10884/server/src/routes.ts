import { Router, Request, Response } from 'express';
import { store } from './store';
import { CreateBatchRequest, IssueCallbackRequest, RevokeCallbackRequest, CompensationRequest } from './types';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/batches', (req: Request, res: Response) => {
  const batches = store.getAllBatches();
  res.json(batches);
});

router.get('/batches/:id', (req: Request, res: Response) => {
  const batch = store.getBatchById(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  res.json(batch);
});

router.post('/batches', (req: Request<{}, {}, CreateBatchRequest>, res: Response) => {
  const { name, createdBy, deviceGroups, expiryThresholdDays } = req.body;
  
  if (!name || !createdBy || !deviceGroups || expiryThresholdDays === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const batch = store.createBatch({ name, createdBy, deviceGroups, expiryThresholdDays });
  res.status(201).json(batch);
});

router.post('/batches/:id/issue-callback', (req: Request<{ id: string }, {}, IssueCallbackRequest>, res: Response) => {
  const { id } = req.params;
  const { deviceId, success, certSn, receipt, error } = req.body;

  if (!deviceId || success === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const batch = store.updateIssueResult(id, deviceId, success, certSn, receipt, error);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  res.json({ success: true, batch });
});

router.post('/batches/:id/revoke-callback', (req: Request<{ id: string }, {}, RevokeCallbackRequest>, res: Response) => {
  const { id } = req.params;
  const { deviceId, success, receipt, error } = req.body;

  if (!deviceId || success === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const batch = store.updateRevokeResult(id, deviceId, success, receipt, error);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  res.json({ success: true, batch });
});

router.post('/batches/:id/compensate', (req: Request<{ id: string }, {}, CompensationRequest>, res: Response) => {
  const { id } = req.params;
  const { deviceIds, operator } = req.body;

  if (!deviceIds || !deviceIds.length || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const attempts = store.addCompensationAttempt(id, deviceIds, operator);
  res.json({ success: true, attempts });
});

router.get('/batches/:id/report', (req: Request, res: Response) => {
  const report = store.generateReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  res.json(report);
});

router.get('/devices', (req: Request, res: Response) => {
  const devices = store.getAllDevices();
  res.json(devices);
});

router.get('/device-groups', (req: Request, res: Response) => {
  const groups = [
    { id: 'factory-a', name: 'A厂区', count: 5 },
    { id: 'factory-b', name: 'B厂区', count: 5 },
    { id: 'warehouse', name: '仓库', count: 3 },
    { id: 'retail', name: '零售门店', count: 2 },
    { id: 'logistics', name: '物流', count: 3 }
  ];
  res.json(groups);
});

export default router;