import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError, AppError } from '../utils/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        const validationError = new AppError(
          'INVALID_INPUT',
          message,
          400,
          {
            raw_input: req.body,
            processing_basis: '参数验证失败',
            conclusion: '输入数据格式不正确',
          }
        );
        next(validationError);
      } else {
        next(err);
      }
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        const validationError = new AppError(
          'INVALID_INPUT',
          message,
          400,
          {
            raw_input: req.query,
            processing_basis: '查询参数验证失败',
            conclusion: '查询参数格式不正确',
          }
        );
        next(validationError);
      } else {
        next(err);
      }
    }
  };
}
