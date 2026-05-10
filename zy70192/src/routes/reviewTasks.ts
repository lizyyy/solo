import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as reviewTaskService from '../services/reviewTaskService';

const router = Router();
const DEFAULT_OPERATOR = 'system';

const getOperator = (req: Request): string => {
  return req.header('x-operator') || DEFAULT_OPERATOR;
};

router.post('/', (req: Request, res: Response) => {
  try {
    const { sampleId, assignee, taskType, priority, dueDate } = req.body;
    
    if (!sampleId || !assignee || !taskType) {
      return res.status(400).json(errorResponse('缺少必要参数: sampleId, assignee, taskType'));
    }

    const task = reviewTaskService.createReviewTask(
      { sampleId, assignee, taskType, priority, dueDate },
      getOperator(req)
    );

    res.status(201).json(successResponse(task, '评审任务创建成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Create review task error:', error);
    res.status(500).json(errorResponse('创建评审任务失败'));
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { sampleId, assignee, status, taskType, priority, page, pageSize } = req.query;
    
    const result = reviewTaskService.listReviewTasks(
      {
        sampleId: sampleId as string,
        assignee: assignee as string,
        status: status as any,
        taskType: taskType as any,
        priority: priority as any
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('List review tasks error:', error);
    res.status(500).json(errorResponse('获取评审任务列表失败'));
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const { assignee } = req.query;
    const summary = reviewTaskService.getReviewTaskSummary(assignee as string);
    res.json(successResponse(summary));
  } catch (error) {
    console.error('Get review task summary error:', error);
    res.status(500).json(errorResponse('获取汇总信息失败'));
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = reviewTaskService.getReviewTaskById(req.params.id);
    res.json(successResponse(task));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get review task error:', error);
    res.status(500).json(errorResponse('获取评审任务失败'));
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status, opinion, rating } = req.body;
    
    if (!status) {
      return res.status(400).json(errorResponse('缺少参数: status'));
    }

    const task = reviewTaskService.updateReviewTaskStatus(
      req.params.id,
      status,
      getOperator(req),
      { opinion, rating }
    );

    res.json(successResponse(task, '任务状态更新成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Update review task status error:', error);
    res.status(500).json(errorResponse('更新任务状态失败'));
  }
});

export default router;
