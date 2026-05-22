import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: UserRole;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  const userName = req.headers['x-user-name'] as string;
  const userRole = req.headers['x-user-role'] as string;

  if (!userId || !userName || !userRole) {
    return res.status(401).json({
      success: false,
      message: '缺少认证信息',
      timestamp: Date.now()
    });
  }

  if (!Object.values(UserRole).includes(userRole as UserRole)) {
    return res.status(403).json({
      success: false,
      message: '无效的用户角色',
      timestamp: Date.now()
    });
  }

  req.user = {
    id: userId,
    name: userName,
    role: userRole as UserRole
  };

  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证',
        timestamp: Date.now()
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
        timestamp: Date.now()
      });
    }

    next();
  };
}
