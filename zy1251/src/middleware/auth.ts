import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, AuthUser } from '../types';
import { verifyToken } from '../utils/jwt';
import prisma from '../lib/prisma';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthError('缺少认证令牌', 401, 'MISSING_TOKEN'));
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return next(new AuthError('令牌无效或已过期', 401, 'INVALID_TOKEN'));
  }

  if (payload.type !== 'access') {
    return next(new AuthError('令牌类型错误', 401, 'INVALID_TOKEN_TYPE'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return next(new AuthError('用户不存在或已被禁用', 401, 'USER_DISABLED'));
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code)
        )
      )
    );

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(new AuthError('认证失败', 500, 'AUTH_ERROR'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError('请先登录', 401, 'UNAUTHORIZED'));
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));
    if (!hasRole) {
      return next(
        new AuthError('没有权限访问此资源', 403, 'INSUFFICIENT_ROLE')
      );
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError('请先登录', 401, 'UNAUTHORIZED'));
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );
    if (!hasPermission) {
      return next(
        new AuthError('没有权限执行此操作', 403, 'INSUFFICIENT_PERMISSION')
      );
    }

    next();
  };
}
