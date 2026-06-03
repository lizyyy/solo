import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CustodyService } from '../services/CustodyService.js';

const IdParamSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
});

const AdjustmentIdParamSchema = z.object({
  adjustmentId: z.string().min(1, '调整条ID不能为空'),
});

const CreateCustodySchema = z.object({
  adjustmentId: z.string().min(1, '调整条ID不能为空'),
  voucherNo: z.string().min(1, '凭证号不能为空'),
  custodyDate: z.string().min(1, '托管日期不能为空'),
  amount: z.number().min(0, '金额不能为负数'),
  custodian: z.string().min(1, '托管方不能为空'),
  handler: z.string().min(1, '经办人不能为空'),
  signatureUrl: z.string().optional(),
  hasScannedCopy: z.boolean().default(false),
  supplementaryFields: z.record(z.string(), z.string()).default({}),
  operator: z.string().optional(),
});

const UpdateCustodySchema = CreateCustodySchema.partial().omit({ adjustmentId: true, operator: true });

export const CustodyController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const custodyList = CustodyService.getAll();
      res.json({
        success: true,
        data: custodyList,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const custody = CustodyService.getById(params.id);
      
      if (!custody) {
        res.status(404).json({
          success: false,
          error: '托管确认页不存在',
        });
        return;
      }

      res.json({
        success: true,
        data: custody,
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

  async getByAdjustmentId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = AdjustmentIdParamSchema.parse(req.params);
      const custody = CustodyService.getByAdjustmentId(params.adjustmentId);
      
      res.json({
        success: true,
        data: custody || null,
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

  async getAdjustmentWithCustody(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = AdjustmentIdParamSchema.parse(req.params);
      const result = CustodyService.getAdjustmentWithCustody(params.adjustmentId);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: '调整条不存在',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
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

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = CreateCustodySchema.parse(req.body);
      const { operator, ...custodyData } = body;
      
      const result = CustodyService.createCustody(custodyData, operator);

      res.json({
        success: true,
        data: result,
        message: '托管确认页创建成功，状态已更新为待风控复核',
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
      if (error instanceof Error && error.message === '该调整条已存在托管确认页') {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = IdParamSchema.parse(req.params);
      const body = UpdateCustodySchema.parse(req.body);
      
      const updated = CustodyService.updateCustody(params.id, body);

      res.json({
        success: true,
        data: updated,
        message: '托管确认页更新成功',
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
      if (error instanceof Error && error.message === '托管确认页不存在') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  },

  async getJumpTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = AdjustmentIdParamSchema.parse(req.params);
      const target = CustodyService.getJumpTarget(params.adjustmentId);

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
