import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ErrorCode } from '../types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly suggestion: string;
  public readonly statusCode: number;

  constructor(
    code: ErrorCode,
    message: string,
    suggestion: string,
    statusCode: number = 400,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.suggestion = suggestion;
    this.statusCode = statusCode;
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
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        suggestion: err.suggestion
      }
    };
    return res.status(err.statusCode).json(response);
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      suggestion: '请联系运维人员检查服务状态',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  };
  res.status(500).json(response);
};

export const createError = (
  code: ErrorCode,
  message: string,
  suggestion: string,
  statusCode: number = 400,
  details?: any
): AppError => {
  return new AppError(code, message, suggestion, statusCode, details);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `请求的资源 ${req.path} 不存在`,
      suggestion: '请检查URL是否正确'
    }
  };
  res.status(404).json(response);
};
