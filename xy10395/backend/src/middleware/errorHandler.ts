import { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../utils/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('错误:', err);

  if (err instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      code: err.code,
      message: err.userMessage,
      detail: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    code: 'SYSTEM_ERROR',
    message: '系统繁忙，请稍后重试。如问题持续，请联系技术支持',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};
