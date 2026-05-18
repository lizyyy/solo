import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/repair';
import { VersionConflictError, RepairNotFoundError } from '../storage/repository';
import { InvalidStatusTransitionError, MergeConflictError, ValidationError } from '../services/repairService';

const ERROR_CODE_MAP: Record<string, string> = {
  VersionConflictError: 'VERSION_CONFLICT',
  RepairNotFoundError: 'REPAIR_NOT_FOUND',
  InvalidStatusTransitionError: 'INVALID_STATUS_TRANSITION',
  MergeConflictError: 'MERGE_CONFLICT',
  ValidationError: 'VALIDATION_ERROR',
  SyntaxError: 'INVALID_JSON',
  Error: 'INTERNAL_ERROR'
};

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(`[${new Date().toISOString()}] ${err.name}:`, err.message);

  const errorCode = ERROR_CODE_MAP[err.name] || 'UNKNOWN_ERROR';

  let details: Record<string, any> = {
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  if (err instanceof VersionConflictError) {
    details = {
      ...details,
      repairId: err.repairId,
      expectedVersion: err.expectedVersion,
      actualVersion: err.actualVersion,
      suggestion: '请刷新数据后重试操作'
    };
  } else if (err instanceof RepairNotFoundError) {
    details = {
      ...details,
      repairId: err.repairId,
      suggestion: '请检查报修ID是否正确'
    };
  } else if (err instanceof InvalidStatusTransitionError) {
    details = {
      ...details,
      repairId: err.repairId,
      fromStatus: err.fromStatus,
      toStatus: err.toStatus,
      suggestion: '请按照正确的状态流转顺序操作'
    };
  } else if (err instanceof MergeConflictError) {
    details = {
      ...details,
      sourceRepairId: err.sourceRepairId,
      suggestion: '请检查要合并的报修记录状态'
    };
  } else if (err instanceof ValidationError) {
    details = {
      ...details,
      field: err.field,
      suggestion: '请检查输入字段的格式和内容'
    };
  }

  const apiError: ApiError = {
    code: errorCode,
    message: err.message,
    details,
    timestamp: new Date()
  };

  const statusCode = getStatusCode(err.name);
  res.status(statusCode).json({
    success: false,
    error: apiError
  });
}

function getStatusCode(errorName: string): number {
  switch (errorName) {
    case 'ValidationError':
    case 'InvalidStatusTransitionError':
    case 'MergeConflictError':
      return 400;
    case 'RepairNotFoundError':
      return 404;
    case 'VersionConflictError':
      return 409;
    case 'SyntaxError':
      return 400;
    default:
      return 500;
  }
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
