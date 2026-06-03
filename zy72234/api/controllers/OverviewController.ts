import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChartService } from '../services/ChartService.js';

const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const ClickTargetSchema = z.object({
  adjustmentId: z.string().min(1, '调整条ID不能为空'),
});

export const OverviewController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = ChartService.getOverviewStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  async get3DChartData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = DateRangeSchema.parse(req.query);
      const data = ChartService.get3DChartData(query.startDate, query.endDate);
      
      res.json({
        success: true,
        data,
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

  async getPieChartData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = ChartService.getPieChartData();
      
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getClickTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = ClickTargetSchema.parse(req.params);
      const target = ChartService.getClickTarget(params.adjustmentId);

      res.json({
        success: true,
        data: target,
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
};
