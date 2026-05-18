import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, message: string, code: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[ERROR] ${req.method} ${req.path} - ${err.message}`);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `请求的路径 ${req.method} ${req.path} 不存在`
    }
  });
};

export const validateRequest = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (req.body[field] === undefined) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new ApiError(
        400,
        `缺少必填字段: ${missingFields.join(', ')}`,
        'MISSING_FIELDS',
        { missingFields }
      );
    }

    next();
  };
};
