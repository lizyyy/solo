import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { scheduleService } from '../services/ScheduleService';
import { compensationService } from '../services/CompensationService';
import { taskScheduler } from '../services/TaskScheduler';
import { CompensationType } from '../types';

const router = Router();

router.post('/halls', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, capacity } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ error: '缺少必填参数: name, capacity' });
    }
    const hall = db.createHall(name, capacity);
    res.status(201).json(hall);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/halls', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const halls = db.getAllHalls();
    res.json(halls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/movies', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, duration } = req.body;
    if (!name || !duration) {
      return res.status(400).json({ error: '缺少必填参数: name, duration' });
    }
    const movie = db.createMovie(name, duration);
    res.status(201).json(movie);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/keys', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { movieId, startAt, endAt } = req.body;
    if (!movieId || !startAt || !endAt) {
      return res.status(400).json({ error: '缺少必填参数: movieId, startAt, endAt' });
    }
    const key = db.createKey(movieId, startAt, endAt);
    res.status(201).json(key);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cleaning-rules', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { hallId, duration } = req.body;
    if (!hallId || !duration) {
      return res.status(400).json({ error: '缺少必填参数: hallId, duration' });
    }
    const rule = db.createCleaningRule(hallId, duration);
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { hallId, movieId, startAt } = req.body;
    if (!hallId || !movieId || !startAt) {
      return res.status(400).json({ error: '缺少必填参数: hallId, movieId, startAt' });
    }
    const result = await scheduleService.createSchedule(hallId, movieId, startAt);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { startAt, movieId } = req.body;
    const result = await scheduleService.updateSchedule(req.params.id, { startAt, movieId });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/schedules/:id', (req: Request, res: Response) => {
  try {
    const schedule = scheduleService.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: '排片不存在' });
    }
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schedules/:id/conflicts', (req: Request, res: Response) => {
  try {
    const conflicts = scheduleService.getConflicts(req.params.id);
    res.json(conflicts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules/:id/unlock', (req: Request, res: Response) => {
  try {
    scheduleService.unlockScheduleTickets(req.params.id);
    res.json({ success: true, message: '售票已解锁' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/schedules/:id', (req: Request, res: Response) => {
  try {
    const schedule = scheduleService.cancelSchedule(req.params.id);
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compensations', async (req: Request, res: Response) => {
  try {
    const { scheduleId, types, payload } = req.body;
    if (!scheduleId || !types || !Array.isArray(types)) {
      return res.status(400).json({ error: '缺少必填参数: scheduleId, types' });
    }
    const tasks = compensationService.createCompensationTasks(
      scheduleId,
      types as CompensationType[],
      payload || {},
      3
    );
    res.status(201).json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compensations/:id/execute', async (req: Request, res: Response) => {
  try {
    const result = await compensationService.executeTask(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compensations/:id/retry', async (req: Request, res: Response) => {
  try {
    const result = await compensationService.retryTask(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/compensations/:id', (req: Request, res: Response) => {
  try {
    const task = compensationService.getTaskStatus(req.params.id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schedules/:id/compensations', (req: Request, res: Response) => {
  try {
    const tasks = compensationService.getTasksBySchedule(req.params.id);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduler/run', async (_req: Request, res: Response) => {
  try {
    await taskScheduler.runOnce();
    res.json({ success: true, message: '任务执行完成' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
