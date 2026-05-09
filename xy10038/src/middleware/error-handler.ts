import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { validationResult } from 'express-validator';
import logger from '../config/logger';
import { AppError, ValidationError } from '../utils/errors';
import { errorResponse } from '../utils/response';

export function validationErrorHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors
      .array()
      .map((e: any) => `${e.path}: ${e.msg}`)
      .join('; ');
    return next(new ValidationError(formattedErrors));
  }
  next();
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  let statusCode = 500;
  let message = '服务器内部错误';
  let errorDetail: string | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (!err.isOperational) {
      logger.error(`非操作错误: ${err.stack}`);
    }
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = '数据已存在';
      const target = (err.meta?.target as string[]) || [];
      errorDetail = `字段 ${target.join(', ')} 已存在`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = '记录不存在';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = '外键约束错误';
    } else {
      logger.error(`Prisma错误: ${err.code} - ${err.message}`);
    }
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的Token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token已过期';
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    message = '请求体格式错误';
  } else {
    logger.error(`未处理的错误: ${err.stack}`);
    errorDetail = err.message;
  }

  if (statusCode >= 500) {
    logger.error(`服务器错误 [${statusCode}]: ${err.message}`);
  } else if (statusCode >= 400) {
    logger.warn(`客户端错误 [${statusCode}]: ${err.message}`);
  }

  return errorResponse(res, statusCode, message, errorDetail);
}

export function notFoundHandler(
  req: Request,
  res: Response
): Response {
  logger.warn(`404 - 未找到: ${req.method} ${req.originalUrl}`);
  return errorResponse(res, 404, '接口不存在');
}
