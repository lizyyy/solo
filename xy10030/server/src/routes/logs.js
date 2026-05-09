import express from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response.js';
import { getOperationLogs } from '../services/operationLogService.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { entityType, entityId, action, status, limit, offset } = req.query;
    const result = getOperationLogs({
      entityType,
      entityId,
      action,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    res.json(successResponse(result));
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
