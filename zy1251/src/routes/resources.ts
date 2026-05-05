import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { resourceService } from '../services/resourceService';
import { createAuditLog } from '../services/auditLogService';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

const createResourceSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.string().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

router.get(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { type, includeChildren, page = '1', pageSize = '100' } = req.query;

    const result = await resourceService.listResources(req.user!.tenantId, {
      type: type as string,
      includeChildren: includeChildren === 'true',
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

router.post(
  '/',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = createResourceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: result.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const resource = await resourceService.createResource({
        ...result.data,
        tenantId: req.user!.tenantId,
      });

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'RESOURCE_CREATE',
        resourceType: 'Resource',
        resourceId: resource.id,
        details: { name: resource.name, code: resource.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: resource,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  })
);

router.put(
  '/:id',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = updateResourceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: result.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const resource = await resourceService.updateResource(
        req.params.id,
        req.user!.tenantId,
        result.data
      );

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'RESOURCE_UPDATE',
        resourceType: 'Resource',
        resourceId: resource.id,
        details: { name: resource.name, code: resource.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: resource,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  })
);

router.delete(
  '/:id',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await resourceService.deleteResource(req.params.id, req.user!.tenantId);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'RESOURCE_DELETE',
        resourceType: 'Resource',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  })
);

export default router;
