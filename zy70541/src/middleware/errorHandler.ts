import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { errorResponse, recordError } from '../utils/response';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('错误:', err);

  if (err instanceof AppError) {
    recordError(
      `${req.method} ${req.path}`,
      { body: req.body, params: req.params, query: req.query },
      err.details?.processing_basis || '业务规则校验失败',
      err.details?.conclusion || '操作被拒绝',
      err.message,
      req.headers['x-operator'] as string
    ).catch(console.error);

    return res.status(err.statusCode).json(
      errorResponse(err.code, err.message, err.details)
    );
  }

  recordError(
    `${req.method} ${req.path}`,
    { body: req.body, params: req.params, query: req.query },
    '未捕获的异常',
    '系统内部错误',
    err.message,
    req.headers['x-operator'] as string
  ).catch(console.error);

  res.status(500).json(
    errorResponse('INTERNAL_ERROR', '服务器内部错误', {
      raw_input: { body: req.body, params: req.params, query: req.query },
      processing_basis: '未捕获的异常',
      conclusion: '系统内部错误',
    })
  );
}
