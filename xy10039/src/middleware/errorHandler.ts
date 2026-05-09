import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

export class CustomError extends Error {
  statusCode: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(errors: Record<string, string[]>) {
    super('验证失败', 400, 'VALIDATION_ERROR', errors);
  }
}

export class NotFoundError extends CustomError {
  constructor(entity: string, id?: string) {
    super(`${entity}${id ? ` (${id})` : ''} 未找到`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = '权限不足') {
    super(message, 403, 'FORBIDDEN');
  }
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error(`[${req.method}] ${req.path} - ${err.message}`, {
    error: err.stack,
    code: err.code
  });

  const statusCode = err.statusCode || 500;
  const response: {
    success: boolean;
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
  } = {
    success: false,
    message: err.message || '服务器内部错误',
    code: err.code
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  if (process.env.NODE_ENV === 'development' && err.stack) {
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(new NotFoundError('路由'));
}
