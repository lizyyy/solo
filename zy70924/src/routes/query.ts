import { Router, Request, Response } from 'express';
import * as queryService from '../services/queryService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const records = await queryService.queryRecords(req.query as any);
    res.json(records);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const csv = await queryService.exportToCSV(req.query as any);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="training_records.csv"');
    res.send('\uFEFF' + csv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/verify-count', async (req: Request, res: Response) => {
  try {
    const result = await queryService.verifyExportCount(req.query as any);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/student/:batchId/:employeeId', async (req: Request, res: Response) => {
  try {
    const detail = await queryService.getStudentDetail(req.params.batchId, req.params.employeeId);
    if (!detail) return res.status(404).json({ error: '学员不存在' });
    res.json(detail);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
