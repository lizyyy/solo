export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class InvalidStateTransitionError extends BusinessError {
  constructor(
    fromStatus: string,
    toStatus: string,
    public readonly allowedTransitions: string[]
  ) {
    super(
      `状态流转非法: 不能从 "${fromStatus}" 流转到 "${toStatus}"。允许的目标状态: [${allowedTransitions.join(', ')}]`,
      'INVALID_STATE_TRANSITION',
      { fromStatus, toStatus, allowedTransitions }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class DuplicateSubmissionError extends BusinessError {
  constructor(
    public readonly operationType: string,
    public readonly batchId: string
  ) {
    super(
      `重复提交错误: 批次 "${batchId}" 的 ${operationType} 已完成，不可重复操作`,
      'DUPLICATE_SUBMISSION',
      { operationType, batchId }
    );
    this.name = 'DuplicateSubmissionError';
  }
}

export class BatchNotFoundError extends BusinessError {
  constructor(public readonly batchId: string) {
    super(
      `批次不存在: 未找到编号为 "${batchId}" 的批次`,
      'BATCH_NOT_FOUND',
      { batchId }
    );
    this.name = 'BatchNotFoundError';
  }
}

export class ValidationError extends BusinessError {
  constructor(
    message: string,
    public readonly field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
    this.name = 'ValidationError';
  }
}

export class InspectionRequiredError extends BusinessError {
  constructor(
    public readonly missingInspections: string[]
  ) {
    super(
      `缺少必要的验收项: [${missingInspections.join(', ')}]`,
      'INSPECTION_REQUIRED',
      { missingInspections }
    );
    this.name = 'InspectionRequiredError';
  }
}

export class ConcurrencyConflictError extends BusinessError {
  constructor(
    public readonly batchId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `并发冲突: 批次 "${batchId}" 已被其他操作更新，请刷新后重试`,
      'CONCURRENCY_CONFLICT',
      { expectedVersion, actualVersion }
    );
    this.name = 'ConcurrencyConflictError';
  }
}
