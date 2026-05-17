import { Router, Request, Response } from 'express';
import { quotaService } from '../services/quota';
import { operationLogService } from '../services/operationLog';
import { QuotaStatus } from '../models/QuotaGroup';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { surveyId } = req.query;
    const quotas = await quotaService.findAll(surveyId ? Number(surveyId) : undefined);
    res.json({ success: true, data: quotas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const quota = await quotaService.findById(Number(req.params.id));
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota group not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const logs = await operationLogService.getLogs('quota', Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const quota = await quotaService.create(req.body, operator);
    res.status(201).json({ success: true, data: quota });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const quota = await quotaService.update(Number(req.params.id), req.body, operator);
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota group not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { status, remark } = req.body;
    const quota = await quotaService.updateStatus(
      Number(req.params.id), 
      status as QuotaStatus, 
      operator,
      remark
    );
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota group not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { remark } = req.body;
    const quota = await quotaService.reopenAfterInvalidate(
      Number(req.params.id), 
      operator,
      remark
    );
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota group not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;