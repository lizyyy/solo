import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { taskScheduler } from '../services/taskScheduler';
import { store } from '../dataStore/inMemoryStore';
import { ValidationError } from '../utils/errors';

const router = Router();

function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.requestId
  };
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = store.scheduledTasksStore().findAll();
    res.json(successResponse(req, tasks));
  } catch (error) {
    next(error);
  }
});

router.get('/:taskName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = taskScheduler.getTaskStatus(req.params.taskName);
    res.json(successResponse(req, status));
  } catch (error) {
    next(error);
  }
});

router.post('/:taskName/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await taskScheduler.runTaskManually(req.params.taskName);
    res.json(successResponse(req, { executed: true, taskName: req.params.taskName }));
  } catch (error) {
    next(error);
  }
});

router.post('/:taskName/enable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await taskScheduler.enableTask(req.params.taskName);
    res.json(successResponse(req, { enabled: true, taskName: req.params.taskName }));
  } catch (error) {
    next(error);
  }
});

router.post('/:taskName/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await taskScheduler.disableTask(req.params.taskName);
    res.json(successResponse(req, { disabled: true, taskName: req.params.taskName }));
  } catch (error) {
    next(error);
  }
});

router.get('/:taskName/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = store.scheduledTasksStore().findByName(req.params.taskName);
    if (!task) {
      throw new ValidationError('任务不存在');
    }

    const logs = store.taskExecutionLogsStore().findByTaskId(task.id);
    res.json(successResponse(req, logs));
  } catch (error) {
    next(error);
  }
});

export default router;
