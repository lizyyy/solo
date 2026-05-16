import { CanaryStatus, TransitionType, SchemaCanary } from './types';

const ALLOWED_TRANSITIONS: Record<CanaryStatus, CanaryStatus[]> = {
  [CanaryStatus.PENDING]: [CanaryStatus.CONFIRMED, CanaryStatus.BLOCKED, CanaryStatus.REVOKED],
  [CanaryStatus.CONFIRMED]: [CanaryStatus.REVOKED, CanaryStatus.COMPENSATED],
  [CanaryStatus.BLOCKED]: [CanaryStatus.REVOKED, CanaryStatus.PENDING, CanaryStatus.CONFIRMED],
  [CanaryStatus.REVOKED]: [],
  [CanaryStatus.COMPENSATED]: []
};

const TRANSITION_TO_STATUS: Record<TransitionType, CanaryStatus> = {
  [TransitionType.CONFIRM]: CanaryStatus.CONFIRMED,
  [TransitionType.BLOCK]: CanaryStatus.BLOCKED,
  [TransitionType.REVOKE]: CanaryStatus.REVOKED,
  [TransitionType.COMPENSATE]: CanaryStatus.COMPENSATED
};

export function canTransition(currentStatus: CanaryStatus, targetStatus: CanaryStatus): boolean {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export function getTargetStatus(transitionType: TransitionType): CanaryStatus {
  return TRANSITION_TO_STATUS[transitionType];
}

export function validateTransition(
  canary: SchemaCanary,
  transitionType: TransitionType
): { valid: boolean; reason?: string } {
  const targetStatus = getTargetStatus(transitionType);
  
  if (!targetStatus) {
    return { valid: false, reason: `无效的转换类型: ${transitionType}` };
  }

  if (!canTransition(canary.status, targetStatus)) {
    return {
      valid: false,
      reason: `状态转换不允许: ${canary.status} -> ${targetStatus}`
    };
  }

  return { valid: true };
}

export function isTerminalStatus(status: CanaryStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}

export function getAllowedTransitions(status: CanaryStatus): CanaryStatus[] {
  return [...(ALLOWED_TRANSITIONS[status] ?? [])];
}