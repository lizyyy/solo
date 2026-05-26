import { Router, Request, Response } from 'express';
import * as processingService from '../services/processingService';

const router = Router();

router.post('/attendance/:recordId', async (req: Request, res: Response) => {
  try {
    await processingService.processAttendanceRecord({
      recordId: req.params.recordId,
      ...req.body
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/homework/:recordId', async (req: Request, res: Response) => {
  try {
    await processingService.processHomeworkRecord({
      recordId: req.params.recordId,
      ...req.body
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:recordType/:recordId/history', async (req: Request, res: Response) => {
  try {
    const history = await processingService.getRecordWithHistory(
      req.params.recordType as any,
      req.params.recordId
    );
    if (!history) return res.status(404).json({ error: '记录不存在' });
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
