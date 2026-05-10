import express, { Request, Response } from 'express';
import * as ruleVersionService from '../services/ruleVersionService';
import * as operationLogService from '../services/operationLogService';
import { RuleVersionStatus } from '../types';

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
    const { ruleId, ruleName, content, description, createdBy } = req.body;

    if (!ruleId || !ruleName || !content || !createdBy) {
      return errorResponse(res, '缺少必要字段: ruleId, ruleName, content, createdBy');
    }

    const result = await ruleVersionService.createRuleVersion({
      ruleId,
      ruleName,
      content,
      description,
      createdBy,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { ruleId, status, page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const result = await ruleVersionService.listRuleVersions(
      ruleId as string,
      {
        page: pageNum,
        pageSize: pageSizeNum,
        status: status as RuleVersionStatus,
      }
    );

    const totalPages = Math.ceil(result.total / pageSizeNum);

    return successResponse(res, result.versions, {
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

router.get('/status-info/:status', async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const info = ruleVersionService.getRuleVersionStatusInfo(status as RuleVersionStatus);
    return successResponse(res, info);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await ruleVersionService.getRuleVersionById(id);

    if (!result) {
      return errorResponse(res, `规则版本不存在: ${id}`, 'NOT_FOUND', 404);
    }

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ruleName, content, description, updatedBy } = req.body;

    if (!updatedBy) {
      return errorResponse(res, '缺少必要字段: updatedBy');
    }

    const result = await ruleVersionService.updateRuleVersion(id, {
      ruleName,
      content,
      description,
      updatedBy,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, comment } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await ruleVersionService.submitForApproval(id, {
      operator,
      comment,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, comment } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await ruleVersionService.approveRuleVersion(id, {
      operator,
      comment,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;

    if (!operator || !reason) {
      return errorResponse(res, '缺少必要字段: operator, reason');
    }

    const result = await ruleVersionService.rejectRuleVersion(id, {
      operator,
      reason,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, comment } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await ruleVersionService.publishRuleVersion(id, {
      operator,
      comment,
    });

    return successResponse(res, result);
  } catch (err) {
    const error = err as Error;
    return errorResponse(res, error.message);
  }
});

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;

    if (!operator) {
      return errorResponse(res, '缺少必要字段: operator');
    }

    const result = await ruleVersionService.archiveRuleVersion(id, {
      operator,
      reason,
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
      'RuleVersion',
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
