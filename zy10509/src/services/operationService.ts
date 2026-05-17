import {
  Operation,
  OperationStatus,
  RiskLevel,
  CreateOperationRequest,
  ConfirmOperationRequest,
  ExecuteOperationRequest,
  FailOperationRequest,
  ManualCorrectionRequest,
  QueryOperationsFilter,
  PaginatedResult
} from '../types';
import * as operationRepository from '../repositories/operationRepository';

export class BusinessError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

const RISK_LEVEL_CONFIG = {
  [RiskLevel.LOW]: { requireReview: false, autoLockAfterConfirm: false },
  [RiskLevel.MEDIUM]: { requireReview: true, autoLockAfterConfirm: true },
  [RiskLevel.HIGH]: { requireReview: true, autoLockAfterConfirm: true },
  [RiskLevel.CRITICAL]: { requireReview: true, autoLockAfterConfirm: true }
};

const STATUS_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  [OperationStatus.CREATED]: [OperationStatus.CONFIRMED, OperationStatus.ABORTED],
  [OperationStatus.CONFIRMED]: [OperationStatus.LOCKED, OperationStatus.ABORTED],
  [OperationStatus.LOCKED]: [OperationStatus.EXECUTING, OperationStatus.ABORTED],
  [OperationStatus.EXECUTING]: [OperationStatus.SUCCESS, OperationStatus.FAILED, OperationStatus.NEEDS_MANUAL_CORRECTION],
  [OperationStatus.SUCCESS]: [],
  [OperationStatus.FAILED]: [OperationStatus.NEEDS_MANUAL_CORRECTION, OperationStatus.ABORTED],
  [OperationStatus.ABORTED]: [],
  [OperationStatus.NEEDS_MANUAL_CORRECTION]: [OperationStatus.SUCCESS, OperationStatus.FAILED, OperationStatus.ABORTED]
};

function validateStatusTransition(currentStatus: OperationStatus, targetStatus: OperationStatus): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

export async function createOperation(request: CreateOperationRequest): Promise<Operation> {
  const config = RISK_LEVEL_CONFIG[request.riskLevel];
  
  const operationData = {
    title: request.title,
    description: request.description,
    resourceObject: request.resourceObject,
    resourceType: request.resourceType,
    riskLevel: request.riskLevel,
    executorId: request.executorId,
    executorName: request.executorName,
    planExecuteTime: request.planExecuteTime ? new Date(request.planExecuteTime) : null,
    rawInput: request.rawInput
  };

  const operation = await operationRepository.createOperation(operationData);
  
  if (!config.requireReview) {
    operation.status = OperationStatus.CONFIRMED;
    await operationRepository.updateOperationStatus(operation.id, OperationStatus.CONFIRMED);
  }

  return operation;
}

export async function confirmOperation(
  operationId: string,
  request: ConfirmOperationRequest
): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (operation.executorId === request.reviewerId) {
    throw new BusinessError('执行人和复核人不能为同一人', 'SAME_EXECUTOR_REVIEWER');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.CONFIRMED)) {
    throw new BusinessError(`当前状态(${operation.status})不允许执行确认操作`, 'INVALID_STATUS_TRANSITION');
  }

  const config = RISK_LEVEL_CONFIG[operation.riskLevel];
  
  if (operation.riskLevel === RiskLevel.CRITICAL) {
    const today = new Date().toISOString().split('T')[0];
    const recentCriticalOps = await operationRepository.queryOperations({
      riskLevel: RiskLevel.CRITICAL,
      reviewerId: request.reviewerId,
      startDate: today,
      pageSize: 100
    });
    if (recentCriticalOps.total >= 3) {
      throw new BusinessError('同一人同一天最多复核3个高危操作', 'EXCEED_DAILY_REVIEW_LIMIT');
    }
  }

  let newStatus = OperationStatus.CONFIRMED;
  const updates: any = {
    reviewerId: request.reviewerId,
    reviewerName: request.reviewerName
  };

  if (config.autoLockAfterConfirm) {
    newStatus = OperationStatus.LOCKED;
  }

  await operationRepository.updateOperationStatus(operationId, newStatus, updates);

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function lockOperation(operationId: string): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.LOCKED)) {
    throw new BusinessError(`当前状态(${operation.status})不允许执行锁定操作`, 'INVALID_STATUS_TRANSITION');
  }

  if (!operation.reviewerId) {
    throw new BusinessError('请先完成双人确认后再锁定', 'REVIEW_REQUIRED');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.LOCKED);

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function startExecution(operationId: string): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.EXECUTING)) {
    throw new BusinessError(`当前状态(${operation.status})不允许开始执行`, 'INVALID_STATUS_TRANSITION');
  }

  if (operation.status !== OperationStatus.LOCKED) {
    throw new BusinessError('请先锁定操作后再开始执行', 'LOCK_REQUIRED');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.EXECUTING, {
    actualExecuteTime: new Date()
  });

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function completeOperation(
  operationId: string,
  request: ExecuteOperationRequest
): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.SUCCESS)) {
    throw new BusinessError(`当前状态(${operation.status})不允许标记为成功`, 'INVALID_STATUS_TRANSITION');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.SUCCESS, {
    completeTime: new Date(),
    operationResult: request.operationResult
  });

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function failOperation(
  operationId: string,
  request: FailOperationRequest
): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.FAILED)) {
    throw new BusinessError(`当前状态(${operation.status})不允许标记为失败`, 'INVALID_STATUS_TRANSITION');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.FAILED, {
    completeTime: new Date(),
    operationResult: request.operationResult,
    errorMessage: request.errorMessage
  });

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function abortOperation(operationId: string): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.ABORTED)) {
    throw new BusinessError(`当前状态(${operation.status})不允许中止`, 'INVALID_STATUS_TRANSITION');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.ABORTED, {
    completeTime: new Date()
  });

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function markForManualCorrection(
  operationId: string,
  errorMessage: string
): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (!validateStatusTransition(operation.status, OperationStatus.NEEDS_MANUAL_CORRECTION)) {
    throw new BusinessError(`当前状态(${operation.status})不允许标记为需人工修正`, 'INVALID_STATUS_TRANSITION');
  }

  await operationRepository.updateOperationStatus(operationId, OperationStatus.NEEDS_MANUAL_CORRECTION, {
    errorMessage
  });

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function manualCorrection(
  operationId: string,
  request: ManualCorrectionRequest
): Promise<Operation> {
  const operation = await operationRepository.getOperationById(operationId);
  if (!operation) {
    throw new BusinessError('操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (operation.status !== OperationStatus.NEEDS_MANUAL_CORRECTION) {
    throw new BusinessError('只有状态为"需人工修正"的记录才能执行修正', 'INVALID_STATUS_FOR_CORRECTION');
  }

  await operationRepository.createCorrectionRecord({
    operationId,
    correctorId: request.correctorId,
    correctorName: request.correctorName,
    correctionReason: request.correctionReason,
    originalData: {
      status: operation.status,
      operationResult: operation.operationResult,
      errorMessage: operation.errorMessage
    },
    correctedData: request.correctedData
  });

  if (request.newStatus) {
    if (!validateStatusTransition(operation.status, request.newStatus)) {
      throw new BusinessError(`不允许从当前状态(${operation.status})修正为目标状态(${request.newStatus})`, 'INVALID_STATUS_TRANSITION');
    }
    await operationRepository.updateOperationStatus(operationId, request.newStatus, {
      completeTime: new Date()
    });
  }

  return operationRepository.getOperationById(operationId) as Promise<Operation>;
}

export async function getOperationById(id: string): Promise<Operation | null> {
  return operationRepository.getOperationById(id);
}

export async function getOperationByNo(operationNo: string): Promise<Operation | null> {
  return operationRepository.getOperationByNo(operationNo);
}

export async function queryOperations(
  filter: QueryOperationsFilter
): Promise<PaginatedResult<Operation>> {
  return operationRepository.queryOperations(filter);
}

export async function getAllOperationsForExport(filter: { startDate?: string; endDate?: string } = {}): Promise<Operation[]> {
  return operationRepository.getAllOperationsForExport(filter);
}

export function getRiskLevelDescription(level: RiskLevel): string {
  const descriptions = {
    [RiskLevel.LOW]: '低风险 - 无需双人复核，操作影响范围小',
    [RiskLevel.MEDIUM]: '中风险 - 需要双人复核，操作有一定影响',
    [RiskLevel.HIGH]: '高风险 - 需要双人复核，操作影响较大',
    [RiskLevel.CRITICAL]: '高危 - 需要双人复核，操作影响重大，同一人每天最多复核3次'
  };
  return descriptions[level];
}

export function getStatusDescription(status: OperationStatus): string {
  const descriptions = {
    [OperationStatus.CREATED]: '已创建 - 等待确认',
    [OperationStatus.CONFIRMED]: '已确认 - 可以执行',
    [OperationStatus.LOCKED]: '已锁定 - 准备执行',
    [OperationStatus.EXECUTING]: '执行中 - 正在处理',
    [OperationStatus.SUCCESS]: '成功 - 操作完成',
    [OperationStatus.FAILED]: '失败 - 操作异常',
    [OperationStatus.ABORTED]: '已中止 - 操作取消',
    [OperationStatus.NEEDS_MANUAL_CORRECTION]: '需人工修正 - 异常待处理'
  };
  return descriptions[status];
}
