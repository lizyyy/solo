import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: 'admin' | 'operator' | 'viewer';
    franchiseeId?: string;
  };
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['import', 'reconcile', 'export', 'manage_tasks', 'resolve_anomalies', 'view_all'],
  operator: ['import', 'reconcile', 'export', 'view_all'],
  viewer: ['view_all']
};

const API_TOKEN = 'Bearer tea-chain-verification-2024';

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== API_TOKEN) {
    res.status(401).json({ error: '未授权访问', code: 'UNAUTHORIZED' });
    return;
  }

  const roleHeader = req.headers['x-user-role'] as string;
  const userId = req.headers['x-user-id'] as string || 'unknown';
  const username = req.headers['x-username'] as string || 'unknown';
  const franchiseeId = req.headers['x-franchisee-id'] as string;

  const role = (['admin', 'operator', 'viewer'].includes(roleHeader) ? roleHeader : 'viewer') as 'admin' | 'operator' | 'viewer';

  req.user = {
    userId,
    username,
    role,
    franchiseeId
  };

  next();
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: '未授权访问', code: 'UNAUTHORIZED' });
      return;
    }

    const permissions = ROLE_PERMISSIONS[req.user.role] || [];
    if (!permissions.includes(permission) && !permissions.includes('view_all')) {
      res.status(403).json({ 
        error: '权限不足', 
        code: 'FORBIDDEN',
        requiredPermission: permission,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限', code: 'ADMIN_REQUIRED' });
    return;
  }
  next();
};
