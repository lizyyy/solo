import { Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { successResponse, errorResponse } from '../utils/response';
import { reportService } from '../services/report.service';

export const reportController = {
  validate: {
    summary: [
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
    ],
    trend: [
      query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
    ],
    account: [
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
    ],
    refund: [
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
    ],
  },

  async getBatchSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await reportService.getBatchSummary(startDate, endDate);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getDailyTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const days = parseInt(req.query.days as string || '7', 10);
      const result = await reportService.getDailyTrend(days);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getAccountReport(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await reportService.getAccountReport(startDate, endDate);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getStatusBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportService.getStatusBreakdown();
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getRefundSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'VALIDATION_ERROR', '参数校验失败', 400, { errors: errors.array() });
      }

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await reportService.getRefundSummary(startDate, endDate);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  },
};
