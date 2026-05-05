import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authService } from '../services/authService';
import { authMiddleware, AuthError } from '../middleware/auth';
import { wrapAsync } from '../middleware/error';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { createAuditLog } from '../services/auditLogService';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  tenantSlug: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantSlug: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

router.post(
  '/register',
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = registerSchema.safeParse(req.body);
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

      const { email, password, name, tenantSlug } = result.data;

      let tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });

      if (!tenant) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: '租户不存在，请联系管理员创建',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const user = await authService.register({
        tenantId: tenant.id,
        email,
        password,
        name,
      });

      await createAuditLog({
        tenantId: tenant.id,
        action: 'USER_REGISTER',
        resourceType: 'User',
        resourceId: user.id,
        details: { email },
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

router.post(
  '/login',
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = loginSchema.safeParse(req.body);
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

      const { email, password, tenantSlug } = result.data;

      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });

      if (!tenant) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '用户名或密码错误',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const loginResult = await authService.login({
        tenantId: tenant.id,
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await createAuditLog({
        tenantId: tenant.id,
        userId: loginResult.user.id,
        action: 'USER_LOGIN',
        resourceType: 'User',
        resourceId: loginResult.user.id,
        details: { email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: loginResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('密码错误') || error.message.includes('用户名或密码')) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
          });
        }
        if (error.message.includes('锁定')) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
          });
        }
        if (error.message.includes('禁用')) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ACCOUNT_DISABLED',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
      next(error);
    }
  })
);

router.post(
  '/refresh',
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const result = refreshTokenSchema.safeParse(req.body);
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

      const refreshResult = await authService.refreshToken({
        refreshToken: result.data.refreshToken,
      });

      res.json({
        success: true,
        data: refreshResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('无效') || error.message.includes('过期') || error.message.includes('撤销')) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_REFRESH_TOKEN',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
      next(error);
    }
  })
);

router.post(
  '/logout',
  authMiddleware,
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      await authService.logout(req.user!.id, refreshToken);

      await createAuditLog({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: 'USER_LOGOUT',
        resourceType: 'User',
        resourceId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: { message: '已成功登出' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  })
);

router.get(
  '/me',
  authMiddleware,
  wrapAsync(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    res.json({
      success: true,
      data: req.user,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
