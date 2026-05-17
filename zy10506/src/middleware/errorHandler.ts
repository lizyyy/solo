import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly step?: string;

  constructor(message: string, statusCode: number = 500, step?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.step = step;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('错误详情:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: JSON.stringify(req.body),
    query: JSON.stringify(req.query),
    timestamp: new Date().toISOString()
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: '请求处理失败',
      message: err.message,
      step: err.step,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (err.name === 'SyntaxError') {
    res.status(400).json({
      error: '请求格式错误',
      message: 'JSON 格式不正确',
      timestamp: new Date().toISOString()
    });
    return;
  }

  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'production' 
      ? '服务器发生了未知错误' 
      : err.message,
    timestamp: new Date().toISOString()
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: '资源不存在',
    message: `路径 ${req.method} ${req.path} 不存在`,
    timestamp: new Date().toISOString()
  });
};
