import { Router, type Request, type Response, type NextFunction } from 'express';
import * as taskService from '../services/task.service.js';
import * as layerService from '../services/layer.service.js';
import * as historyService from '../services/history.service.js';
import * as exportService from '../services/export.service.js';
import type { TaskStatus } from '../../shared/types.js';

const router = Router();

router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as TaskStatus | undefined;
    const search = req.query.search as string | undefined;
    const tasks = await taskService.listTasks(status, search);
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.createTask(req.body);
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

router.put('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id/layers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const layers = await layerService.getLayersByTask(req.params.id);
    res.json({ success: true, data: layers });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const histories = await historyService.getTaskHistory(req.params.id);
    res.json({ success: true, data: histories });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id/history/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { layerId, v1, v2 } = req.query as { layerId?: string; v1?: string; v2?: string };
    if (!layerId || v1 === undefined || v2 === undefined) {
      res.status(400).json({ success: false, error: 'Missing required query params: layerId, v1, v2' });
      return;
    }
    const diff = await historyService.compareVersions(layerId, Number(v1), Number(v2));
    if (!diff) {
      res.status(404).json({ success: false, error: 'Versions not found' });
      return;
    }
    res.json({ success: true, data: diff });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await exportService.exportTask(req.params.id, res);
  } catch (err) {
    next(err);
  }
});

export default router;
