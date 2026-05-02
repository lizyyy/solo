import { Router, Request, Response } from 'express';
import { ProjectionService } from '../services/projectionService';
import { ScheduleCreateInput, CheckTrigger } from '../models';

const router = Router();
const projectionService = new ProjectionService();

router.get('/', (req: Request, res: Response) => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  
  let schedules;
  if (start && end) {
    schedules = projectionService.getSchedulesByDateRange(start, end);
  } else {
    schedules = projectionService.getAllSchedules();
  }
  
  res.json(schedules);
});

router.get('/:scheduleId', (req: Request, res: Response) => {
  try {
    const result = projectionService.getScheduleCheckResult(req.params.scheduleId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: ScheduleCreateInput = req.body;
    const actor = req.headers['x-actor'] as string || 'api';
    
    const result = await projectionService.createSchedule(input, actor);
    
    res.status(201).json({
      schedule: result.schedule,
      checkResult: result.checkResult,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:scheduleId/check', async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId;
    const actor = req.headers['x-actor'] as string;
    const trigger = (req.query.trigger as CheckTrigger) || CheckTrigger.ON_DEMAND;
    
    const result = await projectionService.checkSchedule(scheduleId, trigger, actor);
    
    res.json({
      scheduleId,
      overallStatus: result.overallStatus,
      checks: result.checks,
      checkedAt: result.checkedAt,
    });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

router.post('/check-all', async (req: Request, res: Response) => {
  try {
    const actor = req.headers['x-actor'] as string;
    const start = req.query.start as string;
    const end = req.query.end as string;
    
    const dateRange = start && end ? { start, end } : undefined;
    const results = await projectionService.checkAllSchedules(dateRange, actor);
    
    const resultArray = Array.from(results.entries()).map(([scheduleId, result]) => ({
      scheduleId,
      overallStatus: result.overallStatus,
      checks: result.checks,
    }));
    
    res.json({
      total: resultArray.length,
      pass: resultArray.filter(r => r.overallStatus === 'pass').length,
      warn: resultArray.filter(r => r.overallStatus === 'warn').length,
      block: resultArray.filter(r => r.overallStatus === 'block').length,
      results: resultArray,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:scheduleId/cancel', (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId;
    const reason = req.body.reason || '用户取消';
    const actor = req.headers['x-actor'] as string || 'api';
    
    const schedule = projectionService.cancelSchedule(scheduleId, reason, actor);
    res.json({ message: 'Schedule cancelled', schedule });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

router.delete('/:scheduleId', (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId;
    const actor = req.headers['x-actor'] as string || 'api';
    
    projectionService.deleteSchedule(scheduleId, actor);
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

export { router as schedulesRouter };
