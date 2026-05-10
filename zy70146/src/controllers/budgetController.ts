import { Request, Response, NextFunction } from 'express';
import { budgetService } from '../services/budgetService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const budgetController = {
  getOrCreate: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { sloConfigId } = req.params;
    const { referenceTime } = req.query;

    const budget = await budgetService.getOrCreateBudget(
      sloConfigId,
      referenceTime ? new Date(referenceTime as string) : undefined
    );

    res.json({
      success: true,
      data: budget,
    });
  }),

  deductFromBudget: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { sloConfigId, errorSampleId } = req.params;
    const { reason, metadata, operator } = req.body;

    const result = await budgetService.deductFromBudget(sloConfigId, errorSampleId, {
      reason,
      metadata,
      operator,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  getStatus: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { sloConfigId } = req.params;
    const { referenceTime } = req.query;

    const status = await budgetService.getBudgetStatus(
      sloConfigId,
      referenceTime ? new Date(referenceTime as string) : undefined
    );

    res.json({
      success: true,
      data: status,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { isFrozen, windowType, limit } = req.query;

    const options: any = {};
    if (isFrozen !== undefined) options.isFrozen = isFrozen === 'true';
    if (windowType) options.windowType = windowType as string;
    if (limit) options.limit = parseInt(limit as string, 10);

    const budgets = await budgetService.listBudgets(tenantId, options);

    res.json({
      success: true,
      data: budgets,
    });
  }),
};
