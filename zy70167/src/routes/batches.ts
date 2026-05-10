import express, { Request, Response } from 'express';
import * as batchService from '../services/batchRecalculationService';
import * as operationLogService from '../services/operationLogService';
import { BatchStatus } from '../types';

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

router.post('/', async (req: Request, res: Response) => {
  try {
    const { ruleVersionId, batchDate, createdBy } = req.body;

    if (!ruleVersionId || !batchDate || !createdBy) {
      return errorResponse(res, '缺少必要字段: ruleVersionId, batchDate, createdBy');
    }

    const result = await batchService.createBatchRecalculation({
      ruleVersionId,
      batchDate,
      createdBy,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await batchService.getBatchById(id);

    if (!result) {
      return errorResponse(res, `批次不存在: ${id}`, 'NOT_FOUND', 404);
    }

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/rule-version/:ruleVersionId', async (req: Request, res: Response) => {
  try {
    const { ruleVersionId } = req.params;
    const { status, page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await batchService.listBatchesByRuleVersion(
      ruleVersionId,
      {
        page: pageNum,
        pageSize: pageSizeNum,
        status: status as BatchStatus,
      }
    );

    const totalPages = Math.ceil(result.total / pageSizeNum);

    return successResponse(res, result.batches, {
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

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await batchService.startBatch(id, operator);

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/success', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, dataCount, passCount, failCount } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await batchService.completeBatchSuccess(id, {
      operator,
      dataCount,
      passCount,
      failCount,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/fail', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, errorMessage } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await batchService.completeBatchFailed(id, {
      operator,
      errorMessage,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await operationLogService.getEntityHistory(
      'BatchRecalculation',
      id,
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
