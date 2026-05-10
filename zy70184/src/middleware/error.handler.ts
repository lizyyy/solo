import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error';
import { errorResponse } from '../utils/response';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  logger.error(`${req.method} ${req.path} - ${err.message}`);
  logger.error(err.stack);

  if (err instanceof AppError) {
    return errorResponse(
      res,
      err.code,
      err.message,
      err.statusCode,
      err.details
    );
  }

  if (err.name === 'ValidationError') {
    return errorResponse(res, 'VALIDATION_ERROR', err.message, 400);
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: Record<string, unknown> };
    
    if (prismaErr.code === 'P2002') {
      return errorResponse(res, 'DUPLICATE_RECORD', '唯一约束冲突', 409, prismaErr.meta);
    }
    
    if (prismaErr.code === 'P2025') {
      return errorResponse(res, 'NOT_FOUND', '记录不存在', 404);
    }

    return errorResponse(res, 'DATABASE_ERROR', '数据库操作失败', 500, prismaErr.meta);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return errorResponse(res, 'INVALID_JSON', 'JSON格式错误', 400);
  }

  return errorResponse(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
};

export const notFoundHandler = (req: Request, res: Response): Response => {
  return errorResponse(res, 'NOT_FOUND', `路由不存在: ${req.method} ${req.path}`, 404);
};
