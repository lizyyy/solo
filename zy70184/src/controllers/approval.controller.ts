import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { successResponse, paginationResponse, errorResponse } from '../utils/response';
import { approvalService, CreateApprovalFlowInput } from '../services/approval.service';
import { ApprovalLevelConfig } from '../types/payment';

export const approvalController = {
  validate: {
    createFlow: [
      body('flowName').isString().isLength({ min: 1, max: 100 }),
      body('flowType').isString().isLength({ min: 1, max: 50 }),
      body('minAmount').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      body('maxAmount').isString().custom((value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      }),
      body('levels').isArray({ min: 1 }),
      body('levels.*.level').isInt({ min: 1 }),
      body('levels.*.role').isString(),
      body('levels.*.required').isBoolean(),
      body('levels.*.approverIds').optional().isArray(),
      body('description').optional().isString().isLength({ max: 500 }),
    ],
    approve: [
      param('id').isString().isUUID(),
      body('comment').optional().isString().isLength({ max: 500 }),
    ],
    reject: [
      param('id').isString().isUUID(),
      body('reason').isString().isLength({ min: 1, max: 500 }),
    ],
    listFlows: [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('flowType').optional().isString(),
      query('isActive').optional().isBoolean().toBoolean(),
    ],
    getContext: [
      param('id').isString().isUUID(),
    ],
  },

  async createFlow(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const input: CreateApprovalFlowInput = {
        flowName: req.body.flowName,
        flowType: req.body.flowType,
        minAmount: req.body.minAmount,
        maxAmount: req.body.maxAmount,
        levels: req.body.levels as ApprovalLevelConfig[],
        description: req.body.description,
      };

      const result = await approvalService.createFlow(input);

      return successResponse(res, result, '审批流创建成功', 201);
    } catch (error) {
      next(error);
    }
  },

  async listFlows(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);
      const flowType = req.query.flowType as string | undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

      const result = await approvalService.listFlows({
        page,
        pageSize,
        flowType,
        isActive,
      });

      return paginationResponse(res, result.items, result.total, page, pageSize);
    } catch (error) {
      next(error);
    }
  },

  async getApprovalContext(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const context = await approvalService.getApprovalContext(id);

      return successResponse(res, context);
    } catch (error) {
      next(error);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const comment = req.body.comment;
      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const result = await approvalService.approve(id, { id: operatorId, name: operatorName }, comment);

      return successResponse(res, result, result.isFullyApproved ? '审批通过，批次已批准' : '审批通过，等待下一级审批');
    } catch (error) {
      next(error);
    }
  },

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const reason = req.body.reason;
      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const result = await approvalService.reject(id, { id: operatorId, name: operatorName }, reason);

      return successResponse(res, result, '审批拒绝');
    } catch (error) {
      next(error);
    }
  },
};
