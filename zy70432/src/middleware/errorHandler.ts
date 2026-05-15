import { Request, Response, NextFunction } from 'express';
import { FieldError } from '../types';

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      fieldErrors?: FieldError[];
      [key: string]: any;
    };
  };
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    } as ApiErrorResponse);
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误'
    }
  } as ApiErrorResponse);
}

export function validateRequest(_schema: any) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}
