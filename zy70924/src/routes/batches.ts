import { Router, Request, Response } from 'express';
import * as batchService from '../services/batchService';
import * as importService from '../services/importService';
import * as queryService from '../services/queryService';
import * as processingService from '../services/processingService';
import * as certificateService from '../services/certificateService';
import * as auditService from '../services/auditService';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.createBatch(req.body);
    res.status(201).json(batch);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const batches = await batchService.listBatches(req.query as any);
    res.json(batches);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.getBatch(req.params.id);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    res.json(batch);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, operator, reason } = req.body;
    await batchService.updateBatchStatus(req.params.id, status, operator, reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/import/attendance', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const csvContent = req.file?.buffer.toString('utf-8') || '';
    const result = await importService.importAttendanceCSV(req.params.id, csvContent, operator);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/import/homework', async (req: Request, res: Response) => {
  try {
    const { homework, operator } = req.body;
    const result = await importService.importHomeworkJSON(req.params.id, homework, operator);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/return', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    await processingService.returnBatchForRevision(req.params.id, reason, operator);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/certificates/generate', async (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = await certificateService.generateCertificates(req.params.id, operator);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/attendance-report', async (req: Request, res: Response) => {
  try {
    const report = await queryService.getBatchAttendanceReport(req.params.id);
    res.json(report);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await auditService.getAuditLogs({ batch_id: req.params.id });
    res.json(logs);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
