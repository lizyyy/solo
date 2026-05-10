import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as backgroundTaskService from '../services/backgroundTaskService';
import { BackgroundTaskType } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { taskType, payload, maxRetries } = req.body;
    
    if (!taskType || !payload) {
      return res.status(400).json(errorResponse('缺少必要参数: taskType, payload'));
    }

    const validTaskTypes: BackgroundTaskType[] = ['GENERATE_REPORT', 'SEND_NOTIFICATION', 'EXPORT_DATA', 'BATCH_UPDATE', 'SYNC_DATA'];
    if (!validTaskTypes.includes(taskType)) {
      return res.status(400).json(errorResponse(`无效的任务类型: ${taskType}`));
    }

    const task = backgroundTaskService.createBackgroundTask(
      taskType as BackgroundTaskType,
      payload,
      maxRetries || 3
    );

    res.status(202).json(successResponse(task, '后台任务已创建'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Create background task error:', error);
    res.status(500).json(errorResponse('创建后台任务失败'));
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, taskType, page, pageSize } = req.query;
    
    const result = backgroundTaskService.listBackgroundTasks(
      {
        status: status as any,
        taskType: taskType as any
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('List background tasks error:', error);
    res.status(500).json(errorResponse('获取后台任务列表失败'));
  }
});

router.get('/status', (req: Request, res: Response) => {
  try {
    const status = backgroundTaskService.getTaskQueueStatus();
    res.json(successResponse(status));
  } catch (error) {
    console.error('Get task queue status error:', error);
    res.status(500).json(errorResponse('获取任务队列状态失败'));
  }
});

router.post('/queue/start', (req: Request, res: Response) => {
  try {
    backgroundTaskService.startTaskQueue();
    res.json(successResponse(backgroundTaskService.getTaskQueueStatus(), '任务队列已启动'));
  } catch (error) {
    console.error('Start task queue error:', error);
    res.status(500).json(errorResponse('启动任务队列失败'));
  }
});

router.post('/queue/stop', (req: Request, res: Response) => {
  try {
    backgroundTaskService.stopTaskQueue();
    res.json(successResponse(backgroundTaskService.getTaskQueueStatus(), '任务队列已停止'));
  } catch (error) {
    console.error('Stop task queue error:', error);
    res.status(500).json(errorResponse('停止任务队列失败'));
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = backgroundTaskService.getBackgroundTaskById(req.params.id);
    res.json(successResponse(task));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get background task error:', error);
    res.status(500).json(errorResponse('获取后台任务失败'));
  }
});

router.post('/:id/retry', (req: Request, res: Response) => {
  try {
    const task = backgroundTaskService.retryBackgroundTask(req.params.id);
    res.json(successResponse(task, '任务已重置，将重新执行'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Retry background task error:', error);
    res.status(500).json(errorResponse('重试任务失败'));
  }
});

router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const task = backgroundTaskService.cancelBackgroundTask(req.params.id);
    res.json(successResponse(task, '任务已取消'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Cancel background task error:', error);
    res.status(500).json(errorResponse('取消任务失败'));
  }
});

export default router;
