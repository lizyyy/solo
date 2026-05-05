import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { permissionService } from '../services/permissionService';
import { createAuditLog } from '../services/auditLogService';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

const createPermissionSchema = z.object({
  resourceId: z.string(),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

const updatePermissionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.get(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { resourceId, page = '1', pageSize = '100' } = req.query;

    const result = await permissionService.listPermissions(req.user!.tenantId, {
      resourceId: resourceId as string,
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

router.get(
  '/my',
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const permissions = await permissionService.getUserPermissions(
      req.user!.id,
      req.user!.tenantId
    );

    res.json({
      success: true,
      data: permissions,
      timestamp: new Date().toISOString(),
    });
  })
);

router.post(
  '/',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = createPermissionSchema.safeParse(req.body);
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

      const permission = await permissionService.createPermission({
        ...result.data,
        tenantId: req.user!.tenantId,
      });

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'PERMISSION_CREATE',
        resourceType: 'Permission',
        resourceId: permission.id,
        details: { name: permission.name, code: permission.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: permission,
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
      const result = updatePermissionSchema.safeParse(req.body);
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

      const permission = await permissionService.updatePermission(
        req.params.id,
        req.user!.tenantId,
        result.data
      );

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'PERMISSION_UPDATE',
        resourceType: 'Permission',
        resourceId: permission.id,
        details: { name: permission.name, code: permission.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: permission,
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
      await permissionService.deletePermission(req.params.id, req.user!.tenantId);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'PERMISSION_DELETE',
        resourceType: 'Permission',
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
