import { Request, Response, NextFunction } from 'express';
import { SLOTypeValues, TimeWindowTypeValues } from '../types/enums';
import { sloService } from '../services/sloService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const sloController = {
  create: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { name, type, targetValue, timeWindowType, serviceId, endpointId, description, operator } = req.body;

    if (!name || !type || !targetValue || !timeWindowType) {
      throw new ApiError('SLO名称、类型、目标值和时间窗类型必填', 400);
    }

    if (!SLOTypeValues.includes(type)) {
      throw new ApiError(`无效的SLO类型，可选值: ${SLOTypeValues.join(', ')}`, 400);
    }

    if (!TimeWindowTypeValues.includes(timeWindowType)) {
      throw new ApiError(`无效的时间窗类型，可选值: ${TimeWindowTypeValues.join(', ')}`, 400);
    }

    const sloConfig = await sloService.create(tenantId, name, type, targetValue, timeWindowType, {
      serviceId,
      endpointId,
      description,
      operator,
    });

    res.status(201).json({
      success: true,
      data: sloConfig,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { isActive, serviceId, endpointId } = req.query;

    const options: any = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (serviceId) options.serviceId = serviceId as string;
    if (endpointId) options.endpointId = endpointId as string;

    const sloConfigs = await sloService.list(tenantId, options);

    res.json({
      success: true,
      data: sloConfigs,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const sloConfig = await sloService.getById(id);
    if (!sloConfig) {
      throw new ApiError('SLO配置不存在', 404);
    }

    res.json({
      success: true,
      data: sloConfig,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, targetValue, description, isActive } = req.body;

    const sloConfig = await sloService.update(id, { name, targetValue, description, isActive });

    res.json({
      success: true,
      data: sloConfig,
    });
  }),

  activate: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const sloConfig = await sloService.activate(id);

    res.json({
      success: true,
      data: sloConfig,
    });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const sloConfig = await sloService.deactivate(id);

    res.json({
      success: true,
      data: sloConfig,
    });
  }),

  delete: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await sloService.delete(id);

    res.json({
      success: true,
      message: 'SLO配置已删除',
    });
  }),
};
