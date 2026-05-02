import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../types';
import { getUserById } from '../storage/userRepository';

export interface AuthRequest extends Request {
  user?: User;
}

export function createMockUserMiddleware(defaultUser?: User) {
  return function mockUserMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    const userId = req.headers['x-user-id'] as string;
    
    if (userId) {
      const user = getUserById(userId);
      if (user) {
        req.user = user;
        return next();
      }
    }

    if (defaultUser) {
      req.user = defaultUser;
      return next();
    }

    res.status(401).json({
      success: false,
      error: '未授权访问，请提供有效的用户ID'
    });
  };
}

export function requireRoles(requiredRoles: UserRole[]) {
  return function requireRolesMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未授权访问'
      });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `权限不足，需要角色：${requiredRoles.join(', ')}`
      });
    }

    next();
  };
}

export function validateRequestBody(schema: { [key: string]: { required?: boolean; type?: string } }) {
  return function validateRequestBodyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && (req.body[field] === undefined || req.body[field] === null || req.body[field] === '')) {
        errors.push(`缺少必填字段：${field}`);
      }

      if (req.body[field] !== undefined && rules.type) {
        const actualType = Array.isArray(req.body[field]) ? 'array' : typeof req.body[field];
        if (actualType !== rules.type) {
          errors.push(`字段 ${field} 类型错误，期望 ${rules.type}，实际 ${actualType}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  };
}
