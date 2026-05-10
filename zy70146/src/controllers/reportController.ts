import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/reportService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const reportController = {
  generateBudgetReport: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (limit) options.limit = parseInt(limit as string, 10);

    const report = await reportService.generateBudgetReport(tenantId, options);

    res.json({
      success: true,
      data: report,
    });
  }),

  getErrorTrend: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { days, serviceId, endpointId } = req.query;

    const options: any = {};
    if (days) options.days = parseInt(days as string, 10);
    if (serviceId) options.serviceId = serviceId as string;
    if (endpointId) options.endpointId = endpointId as string;

    const trend = await reportService.getErrorTrend(tenantId, options);

    res.json({
      success: true,
      data: trend,
    });
  }),

  getSLOCompliance: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId, sloConfigId } = req.params;

    const compliance = await reportService.getSLOCompliance(tenantId, sloConfigId);

    res.json({
      success: true,
      data: compliance,
    });
  }),

  getProcessBlockers: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;

    const blockers = await reportService.getProcessBlockers(tenantId);

    res.json({
      success: true,
      data: blockers,
    });
  }),
};
