import express from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response.js';
import { getFailedTasks, getFailedTaskById, retryTask, retryAllPendingTasks } from '../services/failedTaskService.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const result = getFailedTasks({
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const task = getFailedTaskById(req.params.id);
    if (!task) {
      return res.status(404).json(errorResponse('任务不存在', 'NOT_FOUND'));
    }
    res.json(successResponse(task));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const result = await retryTask(req.params.id);
    if (result.success) {
      res.json(successResponse(result.data, '重试成功'));
    } else {
      res.status(400).json(errorResponse(result.message, 'RETRY_FAILED'));
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/retry-all', async (req, res) => {
  try {
    const results = await retryAllPendingTasks();
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;
    
    res.json(successResponse({
      total: results.length,
      success: successCount,
      failed: failedCount,
      results
    }, `批量重试完成: ${successCount}成功, ${failedCount}失败`));
  } catch (error) {
    handleError(res, error);
  }
});

function handleError(res, error) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json(errorResponse(error.message, error.code, error.details));
  } else {
    console.error('Unexpected error:', error);
    res.status(500).json(errorResponse('服务器内部错误', 'INTERNAL_ERROR'));
  }
}

export default router;
