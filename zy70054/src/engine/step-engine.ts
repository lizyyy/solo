import { v4 as uuidv4 } from 'uuid';
import {
  CardReplacementRequest,
  CreateReplacementRequest,
  ReplacementStep,
  StepStatus,
  StepRecord,
  LogisticsNode,
  FailureReason,
  CompensationInfo,
  CustomerServiceNote,
  StuckPointResponse,
  HistoryResponse,
  ReplacementStatus,
  CustomerServiceRequest
} from '../types';
import {
  STEP_ORDER,
  STEP_NAMES,
  STEP_DEPENDENCIES,
  LOGISTICS_STEP_ORDER,
  FAILURE_REASON_NAMES,
  COMPENSATION_METHOD_NAMES
} from '../constants';
import { createError, ERROR_CODES } from '../errors';
import { getLogger } from '../logger';

const logger = getLogger();

export function createReplacement(request: CreateReplacementRequest): CardReplacementRequest {
  const now = Date.now();
  const id = uuidv4();

  const applicationStep: StepRecord = {
    step: 'APPLICATION',
    status: 'SUCCESS',
    startedAt: now,
    completedAt: now,
    remark: '换卡申请提交成功'
  };

  const replacement: CardReplacementRequest = {
    id,
    userId: request.userId,
    oldCardNumber: request.oldCardNumber,
    oldCardHolderName: request.oldCardHolderName,
    replacementReason: request.replacementReason,
    shippingAddress: request.shippingAddress,
    status: 'IN_PROGRESS',
    currentStep: 'OLD_CARD_FREEZE',
    steps: {
      APPLICATION: applicationStep
    },
    logisticsNodes: [],
    customerServiceNotes: [],
    createdAt: now,
    updatedAt: now
  };

  logger.info(
    `创建换卡申请成功`,
    { userId: request.userId, oldCardNumber: maskCardNumber(request.oldCardNumber) },
    id,
    'APPLICATION'
  );

  return replacement;
}

export function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length <= 8) {
    return '*'.repeat(cardNumber.length);
  }
  const first4 = cardNumber.slice(0, 4);
  const last4 = cardNumber.slice(-4);
  const middle = cardNumber.length - 8;
  return `${first4}${'*'.repeat(middle)}${last4}`;
}

export function getStepIndex(step: ReplacementStep): number {
  return STEP_ORDER.indexOf(step);
}

export function getPreviousStep(step: ReplacementStep): ReplacementStep | null {
  const index = getStepIndex(step);
  if (index <= 0) return null;
  return STEP_ORDER[index - 1];
}

export function getNextStep(step: ReplacementStep): ReplacementStep | null {
  const index = getStepIndex(step);
  if (index >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[index + 1];
}

export function canStartStep(
  replacement: CardReplacementRequest,
  targetStep: ReplacementStep
): { canStart: boolean; reason?: string } {
  if (replacement.status === 'COMPLETED') {
    return { canStart: false, reason: '换卡流程已完成' };
  }

  if (replacement.status === 'REJECTED') {
    return { canStart: false, reason: '换卡流程已被拒绝' };
  }

  const currentStepRecord = replacement.steps[targetStep];
  if (currentStepRecord?.status === 'SUCCESS') {
    return { canStart: false, reason: `步骤 ${STEP_NAMES[targetStep]} 已完成` };
  }

  const dependencies = STEP_DEPENDENCIES[targetStep];
  for (const dep of dependencies) {
    const depRecord = replacement.steps[dep];
    if (!depRecord) {
      return { canStart: false, reason: `依赖步骤 ${STEP_NAMES[dep]} 尚未开始` };
    }
    if (depRecord.status !== 'SUCCESS') {
      if (depRecord.status === 'FAILED' || depRecord.status === 'REJECTED') {
        return {
          canStart: false,
          reason: `依赖步骤 ${STEP_NAMES[dep]} 已失败/被拒绝，无法继续`
        };
      }
      return { canStart: false, reason: `依赖步骤 ${STEP_NAMES[dep]} 尚未完成` };
    }
  }

  return { canStart: true };
}

export function isStepRejectedOrFailed(replacement: CardReplacementRequest): ReplacementStep | null {
  for (const step of STEP_ORDER) {
    const record = replacement.steps[step];
    if (record && (record.status === 'REJECTED' || record.status === 'FAILED')) {
      return step;
    }
  }
  return null;
}

export function getLastSuccessfulStep(
  replacement: CardReplacementRequest
): { step: ReplacementStep; record: StepRecord } | null {
  for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
    const step = STEP_ORDER[i];
    const record = replacement.steps[step];
    if (record && record.status === 'SUCCESS') {
      return { step, record };
    }
  }
  return null;
}

export function isStuck(replacement: CardReplacementRequest): boolean {
  const failedOrRejectedStep = isStepRejectedOrFailed(replacement);
  if (failedOrRejectedStep) return true;
  return replacement.status === 'STUCK';
}

export function updateStuckStatus(replacement: CardReplacementRequest): void {
  const failedStep = isStepRejectedOrFailed(replacement);

  if (failedStep) {
    const lastSuccess = getLastSuccessfulStep(replacement);
    const failedRecord = replacement.steps[failedStep]!;

    replacement.status = 'STUCK';
    replacement.stuckPoint = {
      step: failedStep,
      reason: failedRecord.failureReason
        ? FAILURE_REASON_NAMES[failedRecord.failureReason] || failedRecord.failureReason
        : '步骤执行失败',
      lastSuccessfulStep: lastSuccess ? lastSuccess.step : 'APPLICATION'
    };

    logger.warn(
      `流程卡在步骤 ${STEP_NAMES[failedStep]}`,
      { reason: replacement.stuckPoint.reason },
      replacement.id,
      failedStep
    );
  } else if (replacement.status === 'STUCK') {
    replacement.status = 'IN_PROGRESS';
    replacement.stuckPoint = undefined;
    logger.info(`流程已解除卡住状态`, {}, replacement.id);
  }
}

export function startStep(
  replacement: CardReplacementRequest,
  step: ReplacementStep,
  operatorId?: string,
  operatorName?: string
): StepRecord {
  const check = canStartStep(replacement, step);
  if (!check.canStart) {
    if (check.reason?.includes('已完成')) {
      throw createError(ERROR_CODES.STEP_ALREADY_COMPLETED, check.reason);
    }
    throw createError(ERROR_CODES.DEPENDENCY_STEP_IN_PROGRESS, check.reason || '无法开始此步骤');
  }

  const record: StepRecord = {
    step,
    status: 'IN_PROGRESS',
    ...(operatorId && { operatorId }),
    ...(operatorName && { operatorName }),
    startedAt: Date.now()
  };

  replacement.steps[step] = record;
  replacement.updatedAt = Date.now();

  logger.info(`开始执行步骤 ${STEP_NAMES[step]}`, {}, replacement.id, step);
  return record;
}

export function completeStep(
  replacement: CardReplacementRequest,
  step: ReplacementStep,
  operatorId?: string,
  operatorName?: string,
  remark?: string
): StepRecord {
  const record = replacement.steps[step];
  if (!record) {
    throw createError(ERROR_CODES.INVALID_STEP_TRANSITION, `步骤 ${STEP_NAMES[step]} 尚未开始`);
  }

  if (record.status === 'SUCCESS') {
    return record;
  }

  record.status = 'SUCCESS';
  record.completedAt = Date.now();
  if (operatorId) record.operatorId = operatorId;
  if (operatorName) record.operatorName = operatorName;
  if (remark) record.remark = remark;

  const nextStep = getNextStep(step);
  if (nextStep) {
    replacement.currentStep = nextStep;
  } else {
    replacement.status = 'COMPLETED';
  }

  replacement.updatedAt = Date.now();

  logger.info(`步骤 ${STEP_NAMES[step]} 完成`, { remark }, replacement.id, step);
  return record;
}

export function rejectStep(
  replacement: CardReplacementRequest,
  step: ReplacementStep,
  reason: FailureReason,
  operatorId?: string,
  operatorName?: string,
  remark?: string
): StepRecord {
  let record = replacement.steps[step];

  if (!record) {
    record = {
      step,
      status: 'REJECTED',
      startedAt: Date.now()
    };
  }

  record.status = 'REJECTED';
  record.failureReason = reason;
  record.completedAt = Date.now();
  if (operatorId) record.operatorId = operatorId;
  if (operatorName) record.operatorName = operatorName;
  if (remark) record.remark = remark;

  replacement.steps[step] = record;
  replacement.currentStep = step;

  updateStuckStatus(replacement);
  replacement.updatedAt = Date.now();

  logger.warn(
    `步骤 ${STEP_NAMES[step]} 被拒绝`,
    { reason: FAILURE_REASON_NAMES[reason] || reason, remark },
    replacement.id,
    step
  );

  return record;
}

export function failStep(
  replacement: CardReplacementRequest,
  step: ReplacementStep,
  reason: FailureReason,
  operatorId?: string,
  operatorName?: string,
  remark?: string
): StepRecord {
  let record = replacement.steps[step];

  if (!record) {
    record = {
      step,
      status: 'FAILED',
      startedAt: Date.now()
    };
  }

  record.status = 'FAILED';
  record.failureReason = reason;
  record.completedAt = Date.now();
  if (operatorId) record.operatorId = operatorId;
  if (operatorName) record.operatorName = operatorName;
  if (remark) record.remark = remark;

  replacement.steps[step] = record;
  replacement.currentStep = step;

  updateStuckStatus(replacement);
  replacement.updatedAt = Date.now();

  logger.error(
    `步骤 ${STEP_NAMES[step]} 执行失败`,
    { reason: FAILURE_REASON_NAMES[reason] || reason, remark },
    replacement.id,
    step
  );

  return record;
}

export function addLogisticsNode(
  replacement: CardReplacementRequest,
  step: LogisticsNode['step'],
  location: string,
  operator?: string,
  remark?: string
): LogisticsNode {
  const lastNode = replacement.logisticsNodes[replacement.logisticsNodes.length - 1];

  if (lastNode?.step === 'SIGNED') {
    throw createError(
      ERROR_CODES.LOGISTICS_ALREADY_DELIVERED,
      '物流已签收，无法继续更新'
    );
  }

  const currentIndex = LOGISTICS_STEP_ORDER.findIndex((s) => s.step === step);
  if (currentIndex === -1) {
    throw createError(ERROR_CODES.VALIDATION_ERROR, `无效的物流节点: ${step}`);
  }

  if (lastNode) {
    const lastIndex = LOGISTICS_STEP_ORDER.findIndex((s) => s.step === lastNode.step);
    if (currentIndex < lastIndex) {
      throw createError(
        ERROR_CODES.LOGISTICS_STEP_OUT_OF_ORDER,
        `物流节点顺序错误：不能在 ${lastNode.step} 之后回到 ${step}`
      );
    }
  }

  const node: LogisticsNode = {
    id: uuidv4(),
    step,
    location,
    ...(operator && { operator }),
    ...(remark && { remark }),
    timestamp: Date.now()
  };

  replacement.logisticsNodes.push(node);
  replacement.updatedAt = Date.now();

  if (step === 'SIGNED') {
    completeStep(replacement, 'LOGISTICS', undefined, operator, `物流已签收: ${location}`);
  }

  logger.info(`新增物流节点`, { step, location }, replacement.id, 'LOGISTICS');

  return node;
}

export function canCompensate(replacement: CardReplacementRequest): boolean {
  const stuckAt = isStepRejectedOrFailed(replacement);
  if (!stuckAt) return false;

  const record = replacement.steps[stuckAt];
  return record?.compensationInfo?.compensated !== true;
}

export function applyCompensation(
  replacement: CardReplacementRequest,
  method: CompensationInfo['method'],
  operatorId?: string,
  operatorName?: string,
  remark?: string
): CompensationInfo {
  if (!canCompensate(replacement)) {
    throw createError(
      ERROR_CODES.CANNOT_COMPENSATE_SUCCESS,
      '该换卡流程当前无法执行补偿'
    );
  }

  const stuckStep = isStepRejectedOrFailed(replacement)!;
  const record = replacement.steps[stuckStep]!;

  const info: CompensationInfo = {
    compensated: true,
    method,
    ...(operatorId && { operatorId }),
    ...(operatorName && { operatorName }),
    processedAt: Date.now(),
    ...(remark && { remark })
  };

  record.compensationInfo = info;
  record.status = 'COMPENSATED';

  updateStuckStatus(replacement);
  replacement.updatedAt = Date.now();

  logger.info(
    `步骤 ${STEP_NAMES[stuckStep]} 已补偿`,
    { method: COMPENSATION_METHOD_NAMES[method] || method },
    replacement.id,
    stuckStep
  );

  return info;
}

export function addCustomerServiceNote(
  replacement: CardReplacementRequest,
  request: CustomerServiceRequest
): CustomerServiceNote {
  const affectsOutcome = request.action === 'APPROVE' || request.action === 'REJECT';

  const note: CustomerServiceNote = {
    id: uuidv4(),
    csrId: request.csrId,
    csrName: request.csrName,
    content: request.content,
    action: request.action || 'NONE',
    affectsOutcome,
    createdAt: Date.now()
  };

  replacement.customerServiceNotes.push(note);
  replacement.updatedAt = Date.now();

  if (request.action === 'APPROVE') {
    logger.info(
      `客服批注: 批准继续`,
      { csr: request.csrName, content: request.content },
      replacement.id
    );
  } else if (request.action === 'REJECT') {
    rejectStep(
      replacement,
      replacement.currentStep,
      'CUSTOMER_REJECT',
      request.csrId,
      request.csrName,
      request.content
    );
  } else {
    logger.info(
      `客服批注`,
      { csr: request.csrName, content: request.content },
      replacement.id
    );
  }

  return note;
}

export function getStuckPointResponse(
  replacement: CardReplacementRequest
): StuckPointResponse {
  const stuck = isStuck(replacement);
  const lastSuccess = getLastSuccessfulStep(replacement);
  const currentStepRecord = replacement.steps[replacement.currentStep];
  const stuckStep = isStepRejectedOrFailed(replacement);

  const suggestedActions: string[] = [];

  if (!stuck) {
    if (replacement.status === 'COMPLETED') {
      suggestedActions.push('流程已完成，无需操作');
    } else {
      suggestedActions.push(`继续执行步骤: ${STEP_NAMES[replacement.currentStep]}`);
    }
  } else {
    suggestedActions.push('查看失败原因，联系相关部门');
    suggestedActions.push('可申请补偿处理');
    suggestedActions.push('联系客服确认后续操作');
  }

  const previousStep = getPreviousStep(replacement.currentStep);
  const previousStepRecord = previousStep ? replacement.steps[previousStep] : undefined;

  return {
    replacementId: replacement.id,
    isStuck: stuck,
    currentStep: replacement.currentStep,
    currentStatus: currentStepRecord?.status || 'PENDING',
    stuckReason: replacement.stuckPoint?.reason,
    lastSuccessfulStep: lastSuccess ? lastSuccess.step : 'APPLICATION',
    lastSuccessfulStepStatus: lastSuccess ? lastSuccess.record.status : 'PENDING',
    previousStepRecord,
    canProceed: !stuck && replacement.status !== 'COMPLETED' && replacement.status !== 'REJECTED',
    suggestedActions
  };
}

export function getHistoryResponse(replacement: CardReplacementRequest): HistoryResponse {
  const stepHistory: Array<{
    step: ReplacementStep;
    status: StepStatus;
    at: number;
    remark?: string;
    failureReason?: FailureReason;
  }> = [];

  for (const step of STEP_ORDER) {
    const record = replacement.steps[step];
    if (record) {
      stepHistory.push({
        step,
        status: record.status,
        at: record.completedAt || record.startedAt,
        remark: record.remark,
        failureReason: record.failureReason
      });
    }
  }

  return {
    replacementId: replacement.id,
    stepHistory,
    logisticsHistory: [...replacement.logisticsNodes],
    csNotesHistory: [...replacement.customerServiceNotes]
  };
}

export function getOverallStatus(replacement: CardReplacementRequest): {
  status: ReplacementStatus;
  description: string;
  progress: number;
} {
  const totalSteps = STEP_ORDER.length;
  let completedSteps = 0;

  for (const step of STEP_ORDER) {
    if (replacement.steps[step]?.status === 'SUCCESS') {
      completedSteps++;
    }
  }

  let description: string;
  switch (replacement.status) {
    case 'DRAFT':
      description = '草稿状态';
      break;
    case 'IN_PROGRESS':
      description = `正在进行: ${STEP_NAMES[replacement.currentStep]}`;
      break;
    case 'STUCK':
      description = `已卡住: ${replacement.stuckPoint?.reason || '未知原因'}`;
      break;
    case 'COMPLETED':
      description = '换卡流程已完成';
      break;
    case 'FAILED':
      description = '换卡流程失败';
      break;
    case 'REJECTED':
      description = '换卡流程被拒绝';
      break;
    default:
      description = '未知状态';
  }

  return {
    status: replacement.status,
    description,
    progress: Math.round((completedSteps / totalSteps) * 100)
  };
}
