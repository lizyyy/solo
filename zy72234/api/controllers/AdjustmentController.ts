import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { ImportService } from '../services/ImportService.js';
import { ProcessService } from '../services/ProcessService.js';

const IdParamSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
});

const ImportCsvSchema = z.object({
  content: z.string().min(1, 'CSV内容不能为空'),
  operator: z.string().optional(),
});

const ImportExcelSchema = z.object({
  operator: z.string().optional(),
});

export const AdjustmentController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = AdjustmentRepo.findAll();
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
      const adjustment = AdjustmentRepo.findById(params.id);
      
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

  async getFlagged(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adjustments = AdjustmentRepo.findFlagged();
      res.json({
        success: true,
        data: adjustments,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProcessHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const history = ProcessService.getProcessHistory(params.id);
      
      res.json({
        success: true,
        data: history,
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

  async importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = ImportCsvSchema.parse(req.body);
      const result = ImportService.importFromCsv(body.content, body.operator);

      for (const item of result.items) {
        ProcessService.recordImport(item.id, body.operator || '小周', item.hasZeroAmountButReversed);
      }

      res.json({
        success: true,
        data: result,
        message: `成功导入 ${result.total} 条记录，其中 ${result.flagged} 条异常记录待处理`,
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

  async importExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: '请上传Excel文件',
        });
        return;
      }

      const query = ImportExcelSchema.parse(req.query);
      const result = ImportService.importFromExcel(req.file.buffer, query.operator);

      for (const item of result.items) {
        ProcessService.recordImport(item.id, query.operator || '小周', item.hasZeroAmountButReversed);
      }

      res.json({
        success: true,
        data: result,
        message: `成功导入 ${result.total} 条记录，其中 ${result.flagged} 条异常记录待处理`,
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
