import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { VersionConflictError, LockConflictError } from '../services/LockService';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export const errorHandlerMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Request error', {
    requestId: req.context?.requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof VersionConflictError) {
    return res.status(409).json({
      error: 'VERSION_CONFLICT',
      message: err.message,
      currentVersion: err.currentVersion,
      yourVersion: err.yourVersion,
    });
  }

  if (err instanceof LockConflictError) {
    return res.status(409).json({
      error: 'LOCK_CONFLICT',
      message: err.message,
      lockedBy: err.lockedBy,
      lockedAt: err.lockedAt,
    });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'DUPLICATE_ENTRY',
        message: '记录已存在',
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: '记录不存在',
      });
    }
  }

  if (err.message?.includes('not found') || err.message?.includes('Not found')) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
    });
  }

  const status = err.status || 500;

  return res.status(status).json({
    error: err.error || 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
    requestId: req.context?.requestId,
  });
};