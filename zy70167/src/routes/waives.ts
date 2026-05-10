import express, { Request, Response } from 'express';
import * as waiveService from '../services/falsePositiveWaiveService';

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
    const { ruleVersionId, batchId, reason, waivedBy, affectedRows } = req.body;

    if (!ruleVersionId || !batchId || !reason || !waivedBy) {
      return errorResponse(res, '缺少必要字段: ruleVersionId, batchId, reason, waivedBy');
    }

    const result = await waiveService.createFalsePositiveWaive({
      ruleVersionId,
      batchId,
      reason,
      waivedBy,
      affectedRows,
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
    const result = await waiveService.getWaiveById(id);

    if (!result) {
      return errorResponse(res, `误报豁免不存在: ${id}`, 'NOT_FOUND', 404);
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
    const { page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await waiveService.listWaivesByRuleVersion(
      ruleVersionId,
      { page: pageNum, pageSize: pageSizeNum }
    );

    const totalPages = Math.ceil(result.total / pageSizeNum);

    return successResponse(res, result.waives, {
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

router.get('/batch/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = await waiveService.listWaivesByBatch(batchId);
    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

export default router;
