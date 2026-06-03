import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReviewService } from '../services/ReviewService.js';
import type { ReviewRequest } from '../../shared/types.js';

const IdParamSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
});

const ReviewSchema = z.object({
  result: z.enum(['normal', 'verify']),
  comment: z.string().min(1, '复核意见不能为空'),
  operator: z.string().min(1, '操作人不能为空'),
});

export const ReviewController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = ReviewService.getAll();
      res.json({
        success: true,
        data: adjustments,
      });
    } catch (error) {
      next(error);
    }
  },

  async getPendingReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = ReviewService.getPendingReviews();
      res.json({
        success: true,
        data: adjustments,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const adjustment = ReviewService.getById(params.id);
      
      if (!adjustment) {
        res.status(404).json({
          success: false,
          error: '调整条不存在',
        });
        return;
      }

      res.json({
        success: true,
        data: adjustment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: '参数错误',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const body = ReviewSchema.parse(req.body) as ReviewRequest;
      
      const updated = ReviewService.review(params.id, body);

      const message = body.result === 'normal'
        ? '风控复核通过，流程已完成'
        : '已标记为需进一步核实';

      res.json({
        success: true,
        data: updated,
        message,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: '参数错误',
          details: error.errors,
        });
        return;
      }
      if (error instanceof Error && error.message === '调整条不存在') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }
      if (error instanceof Error && error.message.includes('状态不是待复核')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  },

  async getFlagged(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = ReviewService.getFlaggedAdjustments();
      res.json({
        success: true,
        data: adjustments,
      });
    } catch (error) {
      next(error);
    }
  },
};
