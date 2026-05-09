import {
  CreateReplacementRequest,
  FreezeCardRequest,
  LogisticsUpdateRequest,
  ActivationRequest,
  RejectStepRequest,
  CompensationRequest,
  CustomerServiceRequest,
  CardReplacementRequest
} from '../types';
import { getRepository } from '../storage/repository';
import { createError, ERROR_CODES } from '../errors';
import * as engine from '../engine/step-engine';

export function create(request: CreateReplacementRequest): CardReplacementRequest {
  if (!request.userId || !request.oldCardNumber || !request.oldCardHolderName) {
    throw createError(ERROR_CODES.VALIDATION_ERROR, '缺少必要参数');
  }

  const replacement = engine.createReplacement(request);
  getRepository().save(replacement);

  return replacement;
}

export function getById(id: string): CardReplacementRequest {
  const replacement = getRepository().findById(id);
  if (!replacement) {
    throw createError(ERROR_CODES.REPLACEMENT_NOT_FOUND, `换卡申请不存在: ${id}`);
  }
  return replacement;
}

export function getByUserId(userId: string): CardReplacementRequest[] {
  return getRepository().findByUserId(userId);
}

export function freezeCard(request: FreezeCardRequest): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  engine.startStep(replacement, 'OLD_CARD_FREEZE', request.operatorId, request.operatorName);
  engine.completeStep(replacement, 'OLD_CARD_FREEZE', request.operatorId, request.operatorName, '旧卡冻结成功');

  getRepository().save(replacement);
  return replacement;
}

export function updateLogistics(request: LogisticsUpdateRequest): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  if (!replacement.steps['LOGISTICS']) {
    engine.startStep(replacement, 'LOGISTICS');
  }

  engine.addLogisticsNode(
    replacement,
    request.step,
    request.location,
    request.operator,
    request.remark
  );

  getRepository().save(replacement);
  return replacement;
}

export function activateCard(request: ActivationRequest): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  engine.startStep(replacement, 'ACTIVATION', request.operatorId, request.operatorName);
  replacement.newCardNumber = request.newCardNumber;
  engine.completeStep(
    replacement,
    'ACTIVATION',
    request.operatorId,
    request.operatorName,
    `新卡激活成功，卡号: ${engine.maskCardNumber(request.newCardNumber)}`
  );

  getRepository().save(replacement);
  return replacement;
}

export function rejectStep(request: RejectStepRequest): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  engine.rejectStep(
    replacement,
    request.step,
    request.reason,
    request.operatorId,
    request.operatorName,
    request.remark
  );

  getRepository().save(replacement);
  return replacement;
}

export function failStep(
  replacementId: string,
  step: 'OLD_CARD_FREEZE' | 'LOGISTICS' | 'ACTIVATION',
  reason: string,
  operatorId?: string,
  operatorName?: string
): CardReplacementRequest {
  const replacement = getById(replacementId);

  engine.failStep(replacement, step, reason as any, operatorId, operatorName);

  getRepository().save(replacement);
  return replacement;
}

export function applyCompensation(request: CompensationRequest): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  engine.applyCompensation(
    replacement,
    request.method,
    request.operatorId,
    request.operatorName,
    request.remark
  );

  getRepository().save(replacement);
  return replacement;
}

export function addCustomerServiceNote(
  request: CustomerServiceRequest
): CardReplacementRequest {
  const replacement = getById(request.replacementId);

  engine.addCustomerServiceNote(replacement, request);

  getRepository().save(replacement);
  return replacement;
}

export function getStuckPoint(replacementId: string) {
  const replacement = getById(replacementId);
  return engine.getStuckPointResponse(replacement);
}

export function getHistory(replacementId: string) {
  const replacement = getById(replacementId);
  return engine.getHistoryResponse(replacement);
}

export function getOverallStatus(replacementId: string) {
  const replacement = getById(replacementId);
  return engine.getOverallStatus(replacement);
}
