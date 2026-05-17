import { Request, Response, NextFunction } from 'express';
import { ExceptionLogDAO } from '../dao/ExceptionLogDAO';
import { v4 as uuidv4 } from 'uuid';

const exceptionLogDAO = new ExceptionLogDAO();

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = err.message;
  let handlingBasis = '系统内部错误';

  if (err.message.includes('不存在')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    handlingBasis = '资源不存在';
  } else if (err.message.includes('无效') || err.message.includes('不能') || err.message.includes('不允许')) {
    statusCode = 400;
    errorCode = 'INVALID_REQUEST';
    handlingBasis = '请求参数验证失败';
  }

  exceptionLogDAO.create({
    requestId,
    endpoint: req.path,
    method: req.method,
    rawInput: {
      body: req.body,
      query: req.query,
      params: req.params
    },
    errorMessage: err.message,
    errorStack: err.stack,
    handlingBasis
  }).catch(logErr => {
    console.error('记录异常日志失败:', logErr);
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      requestId
    }
  });
}

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number = 400, errorCode: string = 'INVALID_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
