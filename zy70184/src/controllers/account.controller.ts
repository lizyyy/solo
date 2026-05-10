import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { successResponse, paginationResponse, errorResponse } from '../utils/response';
import { accountService, CreateAccountInput } from '../services/account.service';
import { AppError } from '../utils/error';

export const accountController = {
  validate: {
    create: [
      body('accountNumber').isString().isLength({ min: 5, max: 32 }),
      body('accountName').isString().isLength({ min: 1, max: 100 }),
      body('bankCode').isString().isLength({ min: 3, max: 20 }),
      body('bankName').isString().isLength({ min: 1, max: 100 }),
      body('accountType').optional().isString(),
      body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    ],
    verify: [
      param('id').isString().isUUID(),
    ],
    toggle: [
      param('id').isString().isUUID(),
    ],
    list: [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('isActive').optional().isBoolean().toBoolean(),
      query('isVerified').optional().isBoolean().toBoolean(),
      query('search').optional().isString(),
    ],
    get: [
      param('id').isString().isUUID(),
    ],
  },

  async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const input: CreateAccountInput = req.body;
      const result = await accountService.createAccount(input);

      return successResponse(res, result, '账户创建成功', 201);
    } catch (error) {
      next(error);
    }
  },

  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const result = await accountService.getAccountById(id);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const isVerified = req.query.isVerified !== undefined ? req.query.isVerified === 'true' : undefined;
      const search = req.query.search as string | undefined;

      const result = await accountService.listAccounts({
        page,
        pageSize,
        isActive,
        isVerified,
        search,
      });

      return paginationResponse(res, result.items, result.total, page, pageSize);
    } catch (error) {
      next(error);
    }
  },

  async verifyAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const operatorId = req.headers['x-operator-id'] as string || 'system';
      const operatorName = req.headers['x-operator-name'] as string || '系统';

      const result = await accountService.verifyAccount(id, operatorId, operatorName);

      return successResponse(res, result, '账户验证成功');
    } catch (error) {
      next(error);
    }
  },

  async toggleAccountStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const { id } = req.params;
      const result = await accountService.toggleAccountStatus(id);

      return successResponse(res, result, '账户状态已更新');
    } catch (error) {
      next(error);
    }
  },
};
