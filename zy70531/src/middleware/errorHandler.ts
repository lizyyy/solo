import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  const errorResponse: ApiError = {
    code: 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  };

  if (err.message.includes('不存在')) {
    res.status(404);
    errorResponse.code = 'NOT_FOUND';
  } else if (err.message.includes('不能为空') || err.message.includes('无效')) {
    res.status(400);
    errorResponse.code = 'BAD_REQUEST';
  } else {
    res.status(500);
  }

  res.json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response) {
  const errorResponse: ApiError = {
    code: 'NOT_FOUND',
    message: '请求的资源不存在',
    timestamp: new Date().toISOString()
  };
  res.status(404).json(errorResponse);
}
