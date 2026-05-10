import { Request, Response, NextFunction } from 'express';
import { FreezeReasonValues } from '../types/enums';
import { freezeService } from '../services/freezeService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const freezeController = {
  freeze: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId } = req.params;
    const { reason, description, operator } = req.body;

    if (!reason) {
      throw new ApiError('冻结原因必填', 400);
    }

    if (!FreezeReasonValues.includes(reason)) {
      throw new ApiError(`无效的冻结原因，可选值: ${FreezeReasonValues.join(', ')}`, 400);
    }

    const result = await freezeService.freezeBudget(budgetId, reason, {
      description,
      operator,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  unfreeze: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId } = req.params;
    const { reason, operator } = req.body;

    const result = await freezeService.unfreezeBudget(budgetId, {
      reason,
      operator,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { isActive, budgetId, limit } = req.query;

    const options: any = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (budgetId) options.budgetId = budgetId as string;
    if (limit) options.limit = parseInt(limit as string, 10);

    const freezes = await freezeService.listFreezes(tenantId, options);

    res.json({
      success: true,
      data: freezes,
    });
  }),

  getActive: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId } = req.params;

    const freeze = await freezeService.getActiveFreeze(budgetId);

    res.json({
      success: true,
      hasActiveFreeze: !!freeze,
      data: freeze,
    });
  }),
};
