import { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { successResponse, paginationResponse, errorResponse } from '../utils/response';
import { limitService, CreateLimitInput } from '../services/limit.service';

export const limitController = {
  validate: {
    create: [
      body('limitType').isString().isLength({ min: 1, max: 50 }),
      body('limitKey').isString().isLength({ min: 1, max: 100 }),
      body('dailyAmountLimit').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      body('dailyCountLimit').isInt({ min: 0 }),
      body('singleAmountMax').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      body('singleAmountMin').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      body('description').optional().isString().isLength({ max: 500 }),
    ],
    check: [
      query('limitType').optional().isString(),
      query('limitKey').optional().isString(),
      query('totalAmount').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      query('totalCount').isInt({ min: 0 }).toInt(),
    ],
    list: [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('limitType').optional().isString(),
      query('isActive').optional().isBoolean().toBoolean(),
    ],
  },

  async createLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const input: CreateLimitInput = req.body;
      const result = await limitService.createLimit(input);

      return successResponse(res, result, '限额规则创建成功', 201);
    } catch (error) {
      next(error);
    }
  },

  async checkLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const limitType = (req.query.limitType as string) || 'GLOBAL';
      const limitKey = (req.query.limitKey as string) || 'DEFAULT';
      const totalAmount = req.query.totalAmount as string;
      const totalCount = parseInt(req.query.totalCount as string, 10);

      const items = Array(totalCount).fill({ amount: '1.00' });

      const result = await limitService.checkBatchLimit(
        limitType,
        limitKey,
        totalAmount,
        totalCount,
        items
      );

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async listLimits(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);
      const limitType = req.query.limitType as string | undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

      const result = await limitService.listLimits({
        page,
        pageSize,
        limitType,
        isActive,
      });

      return paginationResponse(res, result.items, result.total, page, pageSize);
    } catch (error) {
      next(error);
    }
  },
};
