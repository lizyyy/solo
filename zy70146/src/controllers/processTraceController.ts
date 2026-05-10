import { Request, Response, NextFunction } from 'express';
import { ProcessStepValues, ProcessStatusValues } from '../types/enums';
import { processTraceService } from '../services/processTraceService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const processTraceController = {
  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const trace = await processTraceService.getById(id);
    if (!trace) {
      throw new ApiError('流程记录不存在', 404);
    }

    res.json({
      success: true,
      data: trace,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { step, status, sloConfigId, limit } = req.query;

    const options: any = {};
    if (step && (ProcessStepValues as string[]).includes(step as string)) {
      options.step = step as string;
    }
    if (status && (ProcessStatusValues as string[]).includes(status as string)) {
      options.status = status as string;
    }
    if (sloConfigId) options.sloConfigId = sloConfigId as string;
    if (limit) options.limit = parseInt(limit as string, 10);

    const traces = await processTraceService.list(tenantId, options);

    res.json({
      success: true,
      data: traces,
    });
  }),

  getCurrentBlocker: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { sloConfigId } = req.query;

    const blocker = await processTraceService.getCurrentBlocker(
      tenantId,
      sloConfigId as string
    );

    res.json({
      success: true,
      data: blocker,
    });
  }),

  getTraceChain: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { traceId } = req.params;

    const chain = await processTraceService.getTraceChain(traceId);

    res.json({
      success: true,
      chainLength: chain.length,
      data: chain,
    });
  }),
};
