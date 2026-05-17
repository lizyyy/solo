import { ErrorCode } from '../types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly suggestion?: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    suggestion?: string
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.suggestion = suggestion;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      details,
      '请检查请求参数是否正确'
    );
  }
}

export class DuplicateRequestError extends AppError {
  constructor(existingId: string) {
    super(
      ErrorCode.DUPLICATE_REQUEST,
      '该用户已有相同的组织调整正在处理中',
      { existingAdjustmentId: existingId },
      '请等待当前调整完成或撤回后再提交'
    );
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      ErrorCode.INVALID_STATUS_TRANSITION,
      `不允许从 ${from} 状态转换到 ${to} 状态`,
      { fromStatus: from, toStatus: to },
      '请检查状态流转是否正确'
    );
  }
}

export class AdjustmentNotFoundError extends AppError {
  constructor(id: string) {
    super(
      ErrorCode.ADJUSTMENT_NOT_FOUND,
      `组织调整记录不存在: ${id}`,
      { adjustmentId: id },
      '请确认记录ID是否正确'
    );
  }
}

export class ConflictAdjustmentError extends AppError {
  constructor(userId: string, conflictIds: string[]) {
    super(
      ErrorCode.CONFLICT_ADJUSTMENT,
      `用户 ${userId} 存在冲突的组织调整记录`,
      { userId, conflictAdjustmentIds: conflictIds },
      '请先处理冲突记录后再提交新的调整'
    );
  }
}

export class ImportError extends AppError {
  constructor(message: string, rowNumber?: number, rowData?: any) {
    super(
      ErrorCode.IMPORT_ERROR,
      message,
      { rowNumber, rowData },
      rowNumber ? `请检查第 ${rowNumber} 行数据` : '请检查导入数据格式'
    );
  }
}
