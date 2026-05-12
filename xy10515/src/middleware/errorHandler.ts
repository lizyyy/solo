import { Request, Response, NextFunction } from 'express';
import { ApiError, errorResponse } from '../utils/response';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    return errorResponse(res, err);
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    return errorResponse(res, new ApiError(`数据库错误: ${(err as any).message}`, 400));
  }

  if (err.name === 'PrismaClientValidationError') {
    return errorResponse(res, new ApiError('参数验证失败', 400));
  }

  if (err.name === 'ZodError') {
    return errorResponse(res, new ApiError('参数验证失败', 400, (err as any).errors));
  }

  return errorResponse(res, new ApiError('服务器内部错误', 500));
}
