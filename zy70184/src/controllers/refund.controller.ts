import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { successResponse, paginationResponse, errorResponse } from '../utils/response';
import { refundService, ProcessRefundInput } from '../services/refund.service';
import { RefundReason } from '@prisma/client';

export const refundController = {
  validate: {
    create: [
      body('paymentId').isString().isUUID(),
      body('amount').optional().isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
      }),
      body('reason').isIn(Object.values(RefundReason)),
      body('reasonDetail').optional().isString().isLength({ max: 500 }),
      body('idempotencyKey').isString().isLength({ min: 5, max: 64 }),
    ],
    list: [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('paymentId').optional().isString().isUUID(),
      query('reason').optional().isIn(Object.values(RefundReason)),
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
    ],
    get: [
      param('id').isString().isUUID(),
    ],
  },

  async createRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const input: ProcessRefundInput = {
        paymentId: req.body.paymentId,
        amount: req.body.amount,
        reason: req.body.reason as RefundReason,
        reasonDetail: req.body.reasonDetail,
        idempotencyKey: req.body.idempotencyKey,
        operator: { id: operatorId, name: operatorName },
      };

      const result = await refundService.processRefund(input);

      return successResponse(res, result, '退票处理成功', 201);
    } catch (error) {
      next(error);
    }
  },

  async getRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const result = await refundService.getRefundById(id);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async listRefunds(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);
      const paymentId = req.query.paymentId as string | undefined;
      const reason = req.query.reason as RefundReason | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await refundService.listRefunds({
        page,
        pageSize,
        paymentId,
        reason,
        startDate,
        endDate,
      });

      return paginationResponse(res, result.items, result.total, page, pageSize);
    } catch (error) {
      next(error);
    }
  },
};
