import { Request, Response, NextFunction } from 'express';
import { alertSuppressionService } from '../services/alertSuppressionService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const alertSuppressionController = {
  suppress: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId } = req.params;
    const { alertType, reason, expiresAt, operator } = req.body;

    if (!alertType || !reason) {
      throw new ApiError('告警类型和原因必填', 400);
    }

    const result = await alertSuppressionService.suppressAlert(budgetId, alertType, reason, {
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      operator,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  unsuppress: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { suppressionId } = req.params;
    const { operator } = req.body;

    const result = await alertSuppressionService.unsuppressAlert(suppressionId, {
      operator,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { isActive, budgetId, alertType, limit } = req.query;

    const options: any = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (budgetId) options.budgetId = budgetId as string;
    if (alertType) options.alertType = alertType as string;
    if (limit) options.limit = parseInt(limit as string, 10);

    const suppressions = await alertSuppressionService.listSuppressions(tenantId, options);

    res.json({
      success: true,
      data: suppressions,
    });
  }),

  checkSuppressed: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId, alertType } = req.params;

    const isSuppressed = await alertSuppressionService.isAlertSuppressed(budgetId, alertType);

    res.json({
      success: true,
      isSuppressed,
    });
  }),

  getActive: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { budgetId } = req.params;

    const suppressions = await alertSuppressionService.getActiveSuppressions(budgetId);

    res.json({
      success: true,
      count: suppressions.length,
      data: suppressions,
    });
  }),
};
