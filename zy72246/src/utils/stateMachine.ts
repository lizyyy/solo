import { ProcessingStatus, ProcessStep } from '@/types';

export const STATUS_TRANSITIONS: Record<ProcessingStatus, ProcessingStatus[]> = {
  [ProcessingStatus.PENDING]: [
    ProcessingStatus.SUPPLEMENT_COMPLETED,
    ProcessingStatus.REJECTED,
  ],
  [ProcessingStatus.REVERSAL_PENDING_REVIEW]: [
    ProcessingStatus.NORMAL,
    ProcessingStatus.REJECTED,
    ProcessingStatus.SUPPLEMENT_COMPLETED,
  ],
  [ProcessingStatus.NORMAL]: [
    ProcessingStatus.SUPPLEMENT_COMPLETED,
    ProcessingStatus.REJECTED,
  ],
  [ProcessingStatus.REJECTED]: [
    ProcessingStatus.PENDING,
    ProcessingStatus.NORMAL,
  ],
  [ProcessingStatus.SUPPLEMENT_COMPLETED]: [
    ProcessingStatus.BALANCE_UPDATED,
    ProcessingStatus.PENDING_APPROVAL,
    ProcessingStatus.REJECTED,
    ProcessingStatus.PENDING,
  ],
  [ProcessingStatus.BALANCE_UPDATED]: [
    ProcessingStatus.PENDING_APPROVAL,
    ProcessingStatus.REJECTED,
    ProcessingStatus.SUPPLEMENT_COMPLETED,
  ],
  [ProcessingStatus.PENDING_APPROVAL]: [
    ProcessingStatus.COMPLETED,
    ProcessingStatus.REJECTED,
    ProcessingStatus.SUPPLEMENT_COMPLETED,
    ProcessingStatus.BALANCE_UPDATED,
  ],
  [ProcessingStatus.COMPLETED]: [
    ProcessingStatus.PENDING_APPROVAL,
  ],
};

export const STEP_TRANSITIONS: Record<ProcessStep, ProcessStep[]> = {
  [ProcessStep.STEP_1_IMPORT]: [
    ProcessStep.STEP_2_SUPPLEMENT,
  ],
  [ProcessStep.STEP_2_SUPPLEMENT]: [
    ProcessStep.STEP_3_BALANCE,
    ProcessStep.STEP_1_IMPORT,
  ],
  [ProcessStep.STEP_3_BALANCE]: [
    ProcessStep.STEP_4_SUMMARY,
    ProcessStep.STEP_2_SUPPLEMENT,
  ],
  [ProcessStep.STEP_4_SUMMARY]: [
    ProcessStep.STEP_3_BALANCE,
  ],
};

export function canTransitionStatus(
  fromStatus: ProcessingStatus,
  toStatus: ProcessingStatus
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(toStatus);
}

export function canTransitionStep(
  fromStep: ProcessStep,
  toStep: ProcessStep
): boolean {
  const allowedTransitions = STEP_TRANSITIONS[fromStep];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(toStep);
}

export function getNextAllowedStatuses(currentStatus: ProcessingStatus): ProcessingStatus[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

export function getNextAllowedSteps(currentStep: ProcessStep): ProcessStep[] {
  return STEP_TRANSITIONS[currentStep] || [];
}

export function getStatusDisplayName(status: ProcessingStatus): string {
  const displayNames: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: '待处理',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: '已冲正待复核',
    [ProcessingStatus.NORMAL]: '正常',
    [ProcessingStatus.REJECTED]: '已驳回',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: '补看完成',
    [ProcessingStatus.BALANCE_UPDATED]: '余额已更新',
    [ProcessingStatus.PENDING_APPROVAL]: '待负责人审阅',
    [ProcessingStatus.COMPLETED]: '已完成',
  };
  return displayNames[status] || status;
}

export function getStepDisplayName(step: ProcessStep): string {
  const displayNames: Record<ProcessStep, string> = {
    [ProcessStep.STEP_1_IMPORT]: '第一步：导入',
    [ProcessStep.STEP_2_SUPPLEMENT]: '第二步：补看流水',
    [ProcessStep.STEP_3_BALANCE]: '第三步：余额更新',
    [ProcessStep.STEP_4_SUMMARY]: '第四步：摘要更新',
  };
  return displayNames[step] || step;
}

export function getStatusColor(status: ProcessingStatus): string {
  const colors: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: 'bg-gray-100 text-gray-800 border-gray-300',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: 'bg-orange-100 text-orange-800 border-orange-400',
    [ProcessingStatus.NORMAL]: 'bg-green-100 text-green-800 border-green-300',
    [ProcessingStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-300',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-300',
    [ProcessingStatus.BALANCE_UPDATED]: 'bg-cyan-100 text-cyan-800 border-cyan-400',
    [ProcessingStatus.PENDING_APPROVAL]: 'bg-purple-100 text-purple-800 border-purple-300',
    [ProcessingStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusTextColor(status: ProcessingStatus): string {
  const colors: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: 'text-gray-600',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: 'text-orange-600',
    [ProcessingStatus.NORMAL]: 'text-green-600',
    [ProcessingStatus.REJECTED]: 'text-red-600',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: 'text-blue-600',
    [ProcessingStatus.BALANCE_UPDATED]: 'text-cyan-600',
    [ProcessingStatus.PENDING_APPROVAL]: 'text-purple-600',
    [ProcessingStatus.COMPLETED]: 'text-emerald-600',
  };
  return colors[status] || 'text-gray-600';
}
