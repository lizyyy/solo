import { Request, Response, NextFunction } from 'express';
import { AuditContext } from '../services/audit-service';

declare global {
  namespace Express {
    interface Request {
      auditContext: AuditContext;
    }
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const operator = req.headers['x-operator'] as string;
  const operatorRole = req.headers['x-operator-role'] as string;

  if (!operator || !operatorRole) {
    res.status(400).json({
      error: '缺少审计信息',
      message: '请在请求头中提供 x-operator 和 x-operator-role'
    });
    return;
  }

  req.auditContext = {
    operator,
    operatorRole
  };

  next();
}