import { Request, Response, NextFunction } from 'express';
import { ErrorSource, ErrorSourceValues } from '../types/enums';
import { errorSampleService } from '../services/errorSampleService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const errorSampleController = {
  create: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { serviceId, endpointId, source, errorType, errorMessage, statusCode, timestamp, durationMs, requestId, userId, metadata, operator } = req.body;

    if (!source) {
      throw new ApiError('错误来源必填', 400);
    }

    if (!ErrorSourceValues.includes(source)) {
      throw new ApiError(`无效的错误来源，可选值: ${ErrorSourceValues.join(', ')}`, 400);
    }

    const errorSample = await errorSampleService.create({
      tenantId,
      serviceId,
      endpointId,
      source,
      errorType,
      errorMessage,
      statusCode,
      timestamp: timestamp ? new Date(timestamp) : undefined,
      durationMs,
      requestId,
      userId,
      metadata,
      operator,
    });

    res.status(201).json({
      success: true,
      data: errorSample,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { isDeducted, serviceId, endpointId, source, startDate, endDate, limit } = req.query;

    const options: any = {};
    if (isDeducted !== undefined) options.isDeducted = isDeducted === 'true';
    if (serviceId) options.serviceId = serviceId as string;
    if (endpointId) options.endpointId = endpointId as string;
    if (source) options.source = source as string;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (limit) options.limit = parseInt(limit as string, 10);

    const samples = await errorSampleService.list(tenantId, options);

    res.json({
      success: true,
      data: samples,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const sample = await errorSampleService.getById(id);
    if (!sample) {
      throw new ApiError('错误样本不存在', 404);
    }

    res.json({
      success: true,
      data: sample,
    });
  }),

  getPendingDeductions: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;

    const pending = await errorSampleService.getPendingDeductions(tenantId);

    res.json({
      success: true,
      count: pending.length,
      data: pending,
    });
  }),

  batchRecordAndDeduct: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { serviceId, endpointId, source, errorType, errorMessage, statusCode, timestamp, durationMs, requestId, userId, metadata, operator } = req.body;

    if (!source) {
      throw new ApiError('错误来源必填', 400);
    }

    const results = await errorSampleService.batchRecordAndDeduct(
      tenantId,
      serviceId,
      endpointId,
      {
        source,
        errorType,
        errorMessage,
        statusCode,
        timestamp: timestamp ? new Date(timestamp) : undefined,
        durationMs,
        requestId,
        userId,
        metadata,
        operator,
      }
    );

    res.json({
      success: true,
      processedSLOs: results.length,
      data: results,
    });
  }),
};
