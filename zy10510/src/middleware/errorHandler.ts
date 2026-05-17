import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const errorResponse: ApiError = {
      code: err.code,
      message: err.message,
      details: err.details
    };
    return res.status(err.statusCode).json(errorResponse);
  }

  const errorResponse: ApiError = {
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  res.status(500).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: '请求的资源不存在'
  });
};
