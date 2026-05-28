import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export class ValidationError extends Error {
  statusCode: number;
  error: ApiError;

  constructor(message: string, details?: Record<string, string>, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.error = { code, message, details };
  }
}

export class IdempotencyError extends Error {
  statusCode: number;
  error: ApiError;
  response?: unknown;

  constructor(message: string, response?: unknown) {
    super(message);
    this.name = 'IdempotencyError';
    this.statusCode = 409;
    this.error = { code: 'DUPLICATE_SUBMISSION', message };
    this.response = response;
  }
}

export class StateConstraintError extends Error {
  statusCode: number;
  error: ApiError;

  constructor(message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'StateConstraintError';
    this.statusCode = 403;
    this.error = { code: 'STATE_CONSTRAINT_VIOLATION', message, details };
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  error: ApiError;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.error = { code: 'NOT_FOUND', message };
  }
}

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const details: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join('.');
          details[path] = issue.message;
        });
        throw new ValidationError('请求数据校验失败', details);
      }
      req.body = result.data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const path = issue.path.join('.');
          details[path] = issue.message;
        });
        next(new ValidationError('请求数据校验失败', details));
      } else {
        next(error);
      }
    }
  };
};

export const checkIdempotency = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      next();
      return;
    }

    const existing = await db.getIdempotencyKey(idempotencyKey);
    if (existing) {
      throw new IdempotencyError('检测到重复提交', existing.response);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const saveIdempotencyResponse = async (key: string, response: unknown): Promise<void> => {
  await db.setIdempotencyKey(key, response);
};

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();

  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.error,
      timestamp,
      requestId,
    });
    return;
  }

  if (error instanceof IdempotencyError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.error,
      data: error.response,
      timestamp,
      requestId,
    });
    return;
  }

  if (error instanceof StateConstraintError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.error,
      timestamp,
      requestId,
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.error,
      timestamp,
      requestId,
    });
    return;
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
    timestamp,
    requestId,
  });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API 不存在',
    },
    timestamp,
    requestId,
  });
};
