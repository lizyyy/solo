import express, { Request, Response } from 'express';
import * as logService from '../services/operationLogService';
import { OperationType } from '../types';

const router = express.Router();

function successResponse<T>(
  res: Response,
  data: T,
  pagination?: { page: number; pageSize: number; total: number; totalPages: number }
) {
  const response: {
    success: boolean;
    data: T;
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  } = { success: true, data };
  if (pagination) {
    response.pagination = pagination;
  }
  return res.json(response);
}

function errorResponse(res: Response, message: string, code: string = 'BAD_REQUEST', status: number = 400) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { operationType, entityType, page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await logService.getAllLogs({
      page: pageNum,
      pageSize: pageSizeNum,
      operationType: operationType as OperationType,
      entityType: entityType as string,
    });

    const totalPages = Math.ceil(result.total / pageSizeNum);

    return successResponse(res, result.logs, {
      page: pageNum,
      pageSize: pageSizeNum,
      total: result.total,
      totalPages,
    });
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/entity/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await logService.getEntityHistory(
      entityType,
      entityId,
      { page: pageNum, pageSize: pageSizeNum }
    );

    const totalPages = Math.ceil(result.total / pageSizeNum);

    return successResponse(res, result.logs, {
      page: pageNum,
      pageSize: pageSizeNum,
      total: result.total,
      totalPages,
    });
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

export default router;
