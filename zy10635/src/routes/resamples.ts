import { Router, Request, Response } from 'express';
import { resampleService } from '../services/resample';
import { operationLogService } from '../services/operationLog';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { surveyId, quotaGroupId } = req.query;
    const resamples = await resampleService.findAll(
      surveyId ? Number(surveyId) : undefined,
      quotaGroupId ? Number(quotaGroupId) : undefined
    );
    res.json({ success: true, data: resamples });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const resample = await resampleService.findById(Number(req.params.id));
    if (!resample) {
      return res.status(404).json({ success: false, error: 'Resample reason not found' });
    }
    res.json({ success: true, data: resample });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const logs = await operationLogService.getLogs('resample', Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const resample = await resampleService.create(req.body, operator);
    res.status(201).json({ success: true, data: resample });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/approve', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { approvedCount, remark } = req.body;
    const resample = await resampleService.approve(
      Number(req.params.id),
      approvedCount,
      operator,
      remark
    );
    if (!resample) {
      return res.status(404).json({ success: false, error: 'Resample reason not found' });
    }
    res.json({ success: true, data: resample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/reject', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { remark } = req.body;
    const resample = await resampleService.reject(
      Number(req.params.id),
      operator,
      remark
    );
    if (!resample) {
      return res.status(404).json({ success: false, error: 'Resample reason not found' });
    }
    res.json({ success: true, data: resample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/complete', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { remark } = req.body;
    const resample = await resampleService.complete(
      Number(req.params.id),
      operator,
      remark
    );
    if (!resample) {
      return res.status(404).json({ success: false, error: 'Resample reason not found' });
    }
    res.json({ success: true, data: resample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;