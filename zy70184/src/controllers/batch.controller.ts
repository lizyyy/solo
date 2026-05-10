import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { successResponse, paginationResponse, errorResponse } from '../utils/response';
import { batchService } from '../services/batch.service';
import { CreatePaymentBatchInput, CreatePaymentBatchItem } from '../types/payment';
import { BatchStatus } from '@prisma/client';

export const batchController = {
  validate: {
    create: [
      body('idempotencyKey').isString().isLength({ min: 5, max: 64 }),
      body('batchName').optional().isString().isLength({ max: 100 }),
      body('currency').optional().isString().isLength({ min: 3, max: 3 }),
      body('notes').optional().isString().isLength({ max: 500 }),
      body('items').isArray({ min: 1, max: 500 }),
      body('items.*.accountNumber').isString().isLength({ min: 5, max: 32 }),
      body('items.*.accountName').isString().isLength({ min: 1, max: 100 }),
      body('items.*.bankCode').isString().isLength({ min: 3, max: 20 }),
      body('items.*.bankName').isString().isLength({ min: 1, max: 100 }),
      body('items.*.amount').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
      }),
      body('items.*.currency').optional().isString().isLength({ min: 3, max: 3 }),
      body('items.*.purpose').optional().isString().isLength({ max: 200 }),
      body('items.*.remark').optional().isString().isLength({ max: 500 }),
    ],
    validateOnly: [
      body('items').isArray({ min: 1, max: 500 }),
      body('items.*.accountNumber').isString().isLength({ min: 5, max: 32 }),
      body('items.*.accountName').isString().isLength({ min: 1, max: 100 }),
      body('items.*.bankCode').isString().isLength({ min: 3, max: 20 }),
      body('items.*.bankName').isString().isLength({ min: 1, max: 100 }),
      body('items.*.amount').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
      }),
    ],
    submit: [
      param('id').isString().isUUID(),
    ],
    cancel: [
      param('id').isString().isUUID(),
      body('reason').optional().isString().isLength({ max: 500 }),
    ],
    list: [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('status').optional().isIn(Object.values(BatchStatus)),
      query('initiatorId').optional().isString(),
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
      query('search').optional().isString(),
    ],
    get: [
      param('id').isString().isUUID(),
    ],
  },

  async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const input: CreatePaymentBatchInput = {
        batchName: req.body.batchName,
        currency: req.body.currency,
        idempotencyKey: req.body.idempotencyKey,
        items: req.body.items as CreatePaymentBatchItem[],
        notes: req.body.notes,
        operator: { id: operatorId, name: operatorName },
      };

      const result = await batchService.createBatch(input);

      return successResponse(res, {
        batch: result.batch,
        payments: result.payments,
        validation: result.validation,
      }, '批次创建成功', 201);
    } catch (error) {
      next(error);
    }
  },

  async validateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const input: CreatePaymentBatchInput = {
        idempotencyKey: 'validate_' + Date.now().toString(),
        items: req.body.items as CreatePaymentBatchItem[],
        operator: { id: operatorId, name: operatorName },
      };

      const result = await batchService.validateBatch(input);

      return successResponse(res, result, '校验完成');
    } catch (error) {
      next(error);
    }
  },

  async getBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const result = await batchService.getBatchById(id);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async listBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);
      const status = req.query.status as BatchStatus | undefined;
      const initiatorId = req.query.initiatorId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await batchService.listBatches({
        page,
        pageSize,
        status,
        initiatorId,
        startDate,
        endDate,
        search,
      });

      return paginationResponse(res, result.items, result.total, page, pageSize);
    } catch (error) {
      next(error);
    }
  },

  async submitBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const result = await batchService.submitBatch(id, { id: operatorId, name: operatorName });

      return successResponse(res, result, '批次已提交');
    } catch (error) {
      next(error);
    }
  },

  async cancelBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const reason = req.body.reason || '';
      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const result = await batchService.cancelBatch(id, { id: operatorId, name: operatorName }, reason);

      return successResponse(res, result, '批次已取消');
    } catch (error) {
      next(error);
    }
  },
};
