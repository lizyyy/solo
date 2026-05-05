import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { permissionCheckService } from '../services/permissionCheckService';
import { reportService } from '../services/reportService';
import { createAuditLog } from '../services/auditLogService';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

const checkUserPermissionSchema = z.object({
  userId: z.string(),
  permissionCodes: z.array(z.string()),
});

const checkRolePermissionSchema = z.object({
  roleId: z.string(),
  permissionCode: z.string(),
});

router.post(
  '/check-user',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = checkUserPermissionSchema.safeParse(req.body);
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

      const { userId, permissionCodes } = result.data;

      const checks = await permissionCheckService.checkUserPermissions(
        userId,
        req.user!.tenantId,
        permissionCodes
      );

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'PERMISSION_CHECK',
        resourceType: 'Permission',
        details: { targetUserId: userId, permissionCodes, results: checks.map(c => ({ code: c.permissionCode, granted: c.granted })) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: {
          checks,
          summary: {
            total: checks.length,
            granted: checks.filter((c) => c.granted).length,
            denied: checks.filter((c) => !c.granted).length,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  })
);

router.post(
  '/check-role',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = checkRolePermissionSchema.safeParse(req.body);
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

      const { roleId, permissionCode } = result.data;

      const check = await permissionCheckService.checkRolePermission(
        roleId,
        req.user!.tenantId,
        permissionCode
      );

      res.json({
        success: true,
        data: check,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  })
);

router.get(
  '/user-roles/:userId',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const permissions = await permissionCheckService.getUserRolePermissions(
      req.params.userId,
      req.user!.tenantId
    );

    res.json({
      success: true,
      data: permissions,
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/report',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const report = await reportService.generatePermissionReport(req.user!.tenantId);

    await createAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'REPORT_GENERATE',
      resourceType: 'Report',
      details: { reportType: 'permission_report' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/report/export',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response) => {
    const report = await reportService.generatePermissionReport(req.user!.tenantId);
    const markdown = reportService.reportToMarkdown(report);

    await createAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'REPORT_EXPORT',
      resourceType: 'Report',
      details: { reportType: 'permission_report', format: 'markdown' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="permission-report-${Date.now()}.md"`);
    res.send(markdown);
  })
);

router.get(
  '/report/user/:userId',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const report = await reportService.generateUserPermissionReport(
        req.params.userId,
        req.user!.tenantId
      );

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'REPORT_GENERATE',
        resourceType: 'Report',
        resourceId: req.params.userId,
        details: { reportType: 'user_permission_report' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === '用户不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  })
);

router.get(
  '/report/user/:userId/export',
  requireRole('admin', 'super_admin'),
  wrapAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const report = await reportService.generateUserPermissionReport(
        req.params.userId,
        req.user!.tenantId
      );
      const markdown = reportService.reportToMarkdown(report);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'REPORT_EXPORT',
        resourceType: 'Report',
        resourceId: req.params.userId,
        details: { reportType: 'user_permission_report', format: 'markdown' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="user-permission-report-${req.params.userId}-${Date.now()}.md"`);
      res.send(markdown);
    } catch (error) {
      if (error instanceof Error && error.message === '用户不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
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
