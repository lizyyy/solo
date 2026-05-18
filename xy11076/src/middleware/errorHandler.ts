import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: string;
  suggestion?: string;

  constructor(statusCode: number, code: string, message: string, details?: string, suggestion?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.suggestion = suggestion;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    const response: ApiError = {
      code: err.code,
      message: err.message
    };
    if (err.details) response.details = err.details;
    if (err.suggestion) response.suggestion = err.suggestion;

    return res.status(err.statusCode).json({
      success: false,
      error: response
    });
  }

  console.error('未处理的错误:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
      details: '请联系技术支持人员并提供请求时间和订单信息',
      suggestion: '请稍后重试或联系客服'
    }
  });
};
