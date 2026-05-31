import { Router, Request, Response } from 'express';
import { dataStore } from '../dataStore';
import type { ApiResponse, BatchTask, BatchProcessRequest } from '../../../shared/types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<BatchTask[]>>) => {
  try {
    const tasks = dataStore.getBatchTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取批量任务列表失败' });
  }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response<ApiResponse<BatchTask>>) => {
  try {
    const { id } = req.params;
    const task = dataStore.getBatchTaskById(id);
    if (task) {
      res.json({ success: true, data: task });
    } else {
      res.status(404).json({ success: false, error: '批量任务不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '获取批量任务详情失败' });
  }
});

router.post('/', (req: Request<unknown, unknown, BatchProcessRequest>, res: Response<ApiResponse<BatchTask>>) => {
  try {
    const { inspectionIds, taskName } = req.body;
    const task = dataStore.createBatchTask(inspectionIds, taskName);
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: '创建批量任务失败' });
  }
});

router.post('/:id/run', (req: Request<{ id: string }>, res: Response<ApiResponse<BatchTask>>) => {
  try {
    const { id } = req.params;
    const task = dataStore.runBatchTask(id);
    if (task) {
      res.json({ success: true, data: task });
    } else {
      res.status(404).json({ success: false, error: '批量任务不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '执行批量任务失败' });
  }
});

export default router;
