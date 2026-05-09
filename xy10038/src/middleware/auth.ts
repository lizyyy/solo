import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { authService } from '../services/auth-service';
import { AuthRequest, JwtPayload } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import logger from '../config/logger';

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('缺少认证Token');
    }

    const token = authHeader.split(' ')[1];
    const payload: JwtPayload = await authService.verifyToken(token);

    req.user = payload;
    next();
  } catch (error) {
    logger.warn(`认证失败: ${(error as Error).message}`);
    next(error);
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      return next(new UnauthorizedError('未认证'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`权限不足: 用户 ${req.user.username} 角色 ${req.user.role} 尝试访问需要 ${allowedRoles.join(',')} 角色的资源`);
      return next(new ForbiddenError());
    }

    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireManager = requireRole('ADMIN', 'MANAGER');
export const requireOperator = requireRole('ADMIN', 'MANAGER', 'OPERATOR');
export const requireViewer = requireRole('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');
