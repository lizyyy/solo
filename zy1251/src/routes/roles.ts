import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { roleService } from '../services/roleService';
import { createAuditLog } from '../services/auditLogService';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

const createRoleSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

router.get(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { page = '1', pageSize = '20' } = req.query;

    const result = await roleService.listRoles(req.user!.tenantId, {
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
  '/:id',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const role = await roleService.getRoleWithPermissions(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '角色不存在',
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: role,
      timestamp: new Date().toISOString(),
    });
  })
);

router.post(
  '/',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = createRoleSchema.safeParse(req.body);
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

      const role = await roleService.createRole({
        ...result.data,
        tenantId: req.user!.tenantId,
      });

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'ROLE_CREATE',
        resourceType: 'Role',
        resourceId: role.id,
        details: { name: role.name, code: role.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: role,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === '角色代码已存在') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ROLE_EXISTS',
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
      const result = updateRoleSchema.safeParse(req.body);
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

      const role = await roleService.updateRole(
        req.params.id,
        req.user!.tenantId,
        result.data
      );

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'ROLE_UPDATE',
        resourceType: 'Role',
        resourceId: role.id,
        details: { name: role.name, code: role.code },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: role,
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
      await roleService.deleteRole(req.params.id, req.user!.tenantId);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'ROLE_DELETE',
        resourceType: 'Role',
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
