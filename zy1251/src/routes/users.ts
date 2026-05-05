import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole, requirePermission } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import { createAuditLog } from '../services/auditLogService';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const assignRoleSchema = z.object({
  roleId: z.string(),
});

router.get(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { search, isActive, page = '1', pageSize = '20' } = req.query;

    const result = await userService.listUsers(req.user!.tenantId, {
      search: search as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
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
    const user = await userService.getUserWithRoles(req.params.id);

    if (!user || user.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户不存在',
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  })
);

router.post(
  '/',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = createUserSchema.safeParse(req.body);
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

      const user = await userService.createUser({
        ...result.data,
        tenantId: req.user!.tenantId,
        createdBy: req.user!.id,
      });

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'USER_CREATE',
        resourceType: 'User',
        resourceId: user.id,
        details: { email: user.email, name: user.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === '用户已存在') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
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
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const result = updateUserSchema.safeParse(req.body);
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

    const user = await userService.updateUser(
      req.params.id,
      req.user!.tenantId,
      result.data
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户不存在',
        },
        timestamp: new Date().toISOString(),
      });
    }

    await createAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'USER_UPDATE',
      resourceType: 'User',
      resourceId: user.id,
      details: { 
        name: user.name,
        isActive: user.isActive,
        passwordChanged: !!result.data.password
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  })
);

router.delete(
  '/:id',
  requireRole('super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const user = await userService.getUserWithRoles(req.params.id);

    if (!user || user.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户不存在',
        },
        timestamp: new Date().toISOString(),
      });
    }

    await userService.deleteUser(req.params.id, req.user!.tenantId);

    await createAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'USER_DELETE',
      resourceType: 'User',
      resourceId: req.params.id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(204).send();
  })
);

router.post(
  '/:id/unlock',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const user = await userService.unlockUser(req.params.id, req.user!.tenantId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户不存在',
        },
        timestamp: new Date().toISOString(),
      });
    }

    await createAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'USER_UNLOCK',
      resourceType: 'User',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/:id/roles',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const roles = await roleService.getUserRoles(req.params.id, req.user!.tenantId);

    res.json({
      success: true,
      data: roles,
      timestamp: new Date().toISOString(),
    });
  })
);

router.post(
  '/:id/roles',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = assignRoleSchema.safeParse(req.body);
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

      await roleService.assignRoleToUser(
        req.params.id,
        result.data.roleId,
        req.user!.tenantId,
        req.user!.id
      );

      const roles = await roleService.getUserRoles(req.params.id, req.user!.tenantId);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'USER_ASSIGN_ROLE',
        resourceType: 'User',
        resourceId: req.params.id,
        details: { roleId: result.data.roleId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: roles,
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
  '/:id/roles/:roleId',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await roleService.removeRoleFromUser(
        req.params.id,
        req.params.roleId,
        req.user!.tenantId
      );

      const roles = await roleService.getUserRoles(req.params.id, req.user!.tenantId);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'USER_REMOVE_ROLE',
        resourceType: 'User',
        resourceId: req.params.id,
        details: { roleId: req.params.roleId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: roles,
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

export default router;
