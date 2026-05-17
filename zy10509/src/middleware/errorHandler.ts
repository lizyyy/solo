import { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../services/operationService';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(`[${new Date().toISOString()}] 错误:`, err.message);

  if (err instanceof BusinessError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
    return;
  }

  if (err.name === 'SyntaxError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: '请求体JSON格式错误'
      }
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    }
  });
}
