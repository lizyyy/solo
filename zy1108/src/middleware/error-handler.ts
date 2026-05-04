import { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../errors';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }

  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误',
  });
};

export const wrapAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
