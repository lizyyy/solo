import { Request, Response, NextFunction } from 'express';
import { OperatorInfo } from '../models/types';
import { auditLogger, LogModule } from '../utils/AuditLogger';

export interface AuthenticatedRequest extends Request {
  operator?: OperatorInfo;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const operatorId = req.headers['x-operator-id'] as string;
  const operatorName = req.headers['x-operator-name'] as string;
  const operatorRole = req.headers['x-operator-role'] as string;

  if (!operatorId || !operatorName) {
    return res.status(401).json({
      success: false,
      errorCode: 'MISSING_OPERATOR_INFO',
      errorMessage: '缺少操作人信息，请在请求头中提供 x-operator-id 和 x-operator-name'
    });
  }

  req.operator = {
    operatorId,
    operatorName,
    operatorRole: operatorRole || 'USER',
    timestamp: new Date()
  };

  next();
}

export function errorHandler(err: Error, req: AuthenticatedRequest, res: Response, next: NextFunction) {
  console.error('API Error:', err);

  auditLogger.log({
    module: LogModule.API,
    operation: 'API_ERROR',
    operator: req.operator || {
      operatorId: 'UNKNOWN',
      operatorName: 'UNKNOWN',
      operatorRole: 'UNKNOWN',
      timestamp: new Date()
    },
    targetEntityType: 'API',
    targetEntityId: req.path,
    success: false,
    errorMessage: err.message
  });

  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    errorMessage: '服务器内部错误',
    details: err.message
  });
}

export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (req.operator) {
      auditLogger.log({
        module: LogModule.API,
        operation: `${req.method} ${req.path}`,
        operator: req.operator,
        targetEntityType: 'API_REQUEST',
        targetEntityId: `${req.method}:${req.path}`,
        success: res.statusCode < 400,
        metadata: {
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        }
      });
    }
  });

  next();
}
