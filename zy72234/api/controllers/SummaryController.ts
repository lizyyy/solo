import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SummaryService } from '../services/SummaryService.js';

const IdParamSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
});

export const SummaryController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summaries = SummaryService.generateForAll();
      res.json({
        success: true,
        data: summaries,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const summary = SummaryService.generateForAdjustment(params.id);
      
      if (!summary) {
        res.status(404).json({
          success: false,
          error: '调整条不存在',
        });
        return;
      }

      res.json({
        success: true,
        data: summary,
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

  async getFlagged(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summaries = SummaryService.generateForFlagged();
      res.json({
        success: true,
        data: summaries,
      });
    } catch (error) {
      next(error);
    }
  },
};
