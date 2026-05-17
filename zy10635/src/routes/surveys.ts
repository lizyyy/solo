import { Router, Request, Response } from 'express';
import { surveyService } from '../services/survey';
import { operationLogService } from '../services/operationLog';
import { SurveyStatus } from '../models/Survey';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const surveys = await surveyService.findAll();
    res.json({ success: true, data: surveys });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const survey = await surveyService.findById(Number(req.params.id));
    if (!survey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const logs = await operationLogService.getLogs('survey', Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const survey = await surveyService.create(req.body, operator);
    res.status(201).json({ success: true, data: survey });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const survey = await surveyService.update(Number(req.params.id), req.body, operator);
    if (!survey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { status, remark } = req.body;
    const survey = await surveyService.updateStatus(
      Number(req.params.id), 
      status as SurveyStatus, 
      operator,
      remark
    );
    if (!survey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const { remark } = req.body;
    const survey = await surveyService.reopenAfterInvalidate(
      Number(req.params.id), 
      operator,
      remark
    );
    if (!survey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;