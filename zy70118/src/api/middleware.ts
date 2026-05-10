import express, { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../domain';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export function jsonBodyParser(req: Request, res: Response, next: NextFunction): void {
  express.json()(req, res, next);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('API Error:', err);

  if (err instanceof BusinessError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
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

export function notFoundHandler(
  req: Request,
  res: Response
): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    }
  });
}
