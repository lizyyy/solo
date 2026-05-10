import { Request, Response, NextFunction } from 'express';
import { serviceService, endpointService } from '../services/serviceService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const serviceController = {
  create: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      throw new ApiError('服务名称必填', 400);
    }

    const service = await serviceService.create(tenantId, name, description);

    res.status(201).json({
      success: true,
      data: service,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req.params;

    const services = await serviceService.list(tenantId);

    res.json({
      success: true,
      data: services,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const service = await serviceService.getById(id);
    if (!service) {
      throw new ApiError('服务不存在', 404);
    }

    res.json({
      success: true,
      data: service,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const service = await serviceService.update(id, { name, description });

    res.json({
      success: true,
      data: service,
    });
  }),

  delete: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await serviceService.delete(id);

    res.json({
      success: true,
      message: '服务已删除',
    });
  }),
};

export const endpointController = {
  create: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { serviceId } = req.params;
    const { method, path, description } = req.body;

    if (!method || !path) {
      throw new ApiError('HTTP方法和路径必填', 400);
    }

    const endpoint = await endpointService.create(serviceId, method, path, description);

    res.status(201).json({
      success: true,
      data: endpoint,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { serviceId } = req.params;

    const endpoints = await endpointService.list(serviceId);

    res.json({
      success: true,
      data: endpoints,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const endpoint = await endpointService.getById(id);
    if (!endpoint) {
      throw new ApiError('接口不存在', 404);
    }

    res.json({
      success: true,
      data: endpoint,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { method, path, description } = req.body;

    const endpoint = await endpointService.update(id, { method, path, description });

    res.json({
      success: true,
      data: endpoint,
    });
  }),

  delete: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await endpointService.delete(id);

    res.json({
      success: true,
      message: '接口已删除',
    });
  }),
};
