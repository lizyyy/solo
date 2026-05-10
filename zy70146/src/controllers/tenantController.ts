import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../services/tenantService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const tenantController = {
  create: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, description } = req.body;

    if (!name) {
      throw new ApiError('租户名称必填', 400);
    }

    const tenant = await tenantService.create(name, description);

    res.status(201).json({
      success: true,
      data: tenant,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const tenants = await tenantService.list();

    res.json({
      success: true,
      data: tenants,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const tenant = await tenantService.getById(id);
    if (!tenant) {
      throw new ApiError('租户不存在', 404);
    }

    res.json({
      success: true,
      data: tenant,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const tenant = await tenantService.update(id, { name, description });

    res.json({
      success: true,
      data: tenant,
    });
  }),

  delete: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await tenantService.delete(id);

    res.json({
      success: true,
      message: '租户已删除',
    });
  }),
};
