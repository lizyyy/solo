import { Router, Request, Response } from 'express';
import { sampleService } from '../services/sample';
import { operationLogService } from '../services/operationLog';
import { SampleStatus } from '../models/Sample';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { surveyId, quotaGroupId, status } = req.query;
    const samples = await sampleService.findAll(
      surveyId ? Number(surveyId) : undefined,
      quotaGroupId ? Number(quotaGroupId) : undefined,
      status as SampleStatus
    );
    res.json({ success: true, data: samples });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { surveyId } = req.query;
    if (!surveyId) {
      return res.status(400).json({ success: false, error: 'surveyId is required' });
    }
    const csv = await sampleService.exportSamples(Number(surveyId));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="samples_${surveyId}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sample = await sampleService.findById(Number(req.params.id));
    if (!sample) {
      return res.status(404).json({ success: false, error: 'Sample not found' });
    }
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const logs = await operationLogService.getLogs('sample', Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const sample = await sampleService.create(req.body, operator);
    res.status(201).json({ success: true, data: sample });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { surveyId, samples } = req.body;
    if (!surveyId || !samples) {
      return res.status(400).json({ success: false, error: 'surveyId and samples are required' });
    }
    const result = await sampleService.importSamples(Number(surveyId), samples, operator);
    res.json({ 
      success: true, 
      data: {
        imported: result.success.length,
        failed: result.errors.length,
        errors: result.errors
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/invalid', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { reason, remark } = req.body;
    const sample = await sampleService.markAsInvalid(
      Number(req.params.id), 
      reason,
      operator,
      remark
    );
    if (!sample) {
      return res.status(404).json({ success: false, error: 'Sample not found' });
    }
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/valid', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { remark } = req.body;
    const sample = await sampleService.markAsValid(
      Number(req.params.id),
      operator,
      remark
    );
    if (!sample) {
      return res.status(404).json({ success: false, error: 'Sample not found' });
    }
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;