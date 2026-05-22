import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { createAuditLog } from '../services/auditService.js';
import { Role, rolePermissions, RoleLabel } from '../../shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: Role;
    realName: string;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const db = getDatabase();
    const user = db.prepare('SELECT id, username, role, real_name FROM users WHERE id = ?').get(decoded.userId) as any;
    db.close();

    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      realName: user.real_name
    };

    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: '无效的认证令牌' });
  }
}

export function requirePermission(permission: string, requiredRole?: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' });
    }

    const userPermissions = rolePermissions[req.user.role] || [];
    const hasPermission = userPermissions.includes(permission);

    if (!hasPermission) {
      const auditLogId = createAuditLog({
        userId: req.user.id,
        userName: req.user.realName,
        action: permission,
        resourceType: 'permission_check',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        failureReason: `PERMISSION_DENIED: 需要 ${requiredRole ? RoleLabel[requiredRole] : '更高权限'} 才能执行此操作`
      });

      return res.status(403).json({
        success: false,
        error: '权限不足',
        errorCode: 'PERMISSION_DENIED',
        message: `您当前的角色是「${RoleLabel[req.user.role]}」，${requiredRole ? `需要「${RoleLabel[requiredRole]}」及以上权限` : '没有足够的权限'} 执行此操作`,
        requiredRole: requiredRole || null,
        userRole: req.user.role,
        auditLogId
      });
    }

    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}
