import {
  InvitationBatchStatus,
  EnrollmentStatus,
  OperationResult,
  EventRecord
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface StateTransitionRule {
  entityType: 'batch' | 'enrollment';
  fromStatus: string;
  toStatus: string;
  allowedOperations: string[];
  errorMessage?: string;
}

export const BATCH_STATUS_TRANSITIONS: StateTransitionRule[] = [
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.DRAFT,
    toStatus: InvitationBatchStatus.PUBLISHED,
    allowedOperations: ['publish'],
    errorMessage: '草稿状态下只能执行发布操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.DRAFT,
    toStatus: InvitationBatchStatus.CANCELLED,
    allowedOperations: ['cancel'],
    errorMessage: '草稿状态下只能执行取消操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.PUBLISHED,
    toStatus: InvitationBatchStatus.ENROLLMENT_STARTED,
    allowedOperations: ['start_enrollment'],
    errorMessage: '已发布状态下只能执行开始报名操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.PUBLISHED,
    toStatus: InvitationBatchStatus.CANCELLED,
    allowedOperations: ['cancel'],
    errorMessage: '已发布状态下只能执行取消操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.ENROLLMENT_STARTED,
    toStatus: InvitationBatchStatus.ENROLLMENT_CLOSED,
    allowedOperations: ['close_enrollment'],
    errorMessage: '报名中状态下只能执行结束报名操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.ENROLLMENT_CLOSED,
    toStatus: InvitationBatchStatus.EXECUTION_STARTED,
    allowedOperations: ['start_execution'],
    errorMessage: '报名已结束状态下只能执行开始执行操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.EXECUTION_STARTED,
    toStatus: InvitationBatchStatus.EXECUTION_COMPLETED,
    allowedOperations: ['complete_execution'],
    errorMessage: '执行中状态下只能执行完成执行操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.EXECUTION_COMPLETED,
    toStatus: InvitationBatchStatus.SETTLEMENT_STARTED,
    allowedOperations: ['start_settlement'],
    errorMessage: '执行已完成状态下只能执行开始结算操作'
  },
  {
    entityType: 'batch',
    fromStatus: InvitationBatchStatus.SETTLEMENT_STARTED,
    toStatus: InvitationBatchStatus.SETTLEMENT_COMPLETED,
    allowedOperations: ['complete_settlement'],
    errorMessage: '结算中状态下只能执行完成结算操作'
  }
];

export const ENROLLMENT_STATUS_TRANSITIONS: StateTransitionRule[] = [
  {
    entityType: 'enrollment',
    fromStatus: EnrollmentStatus.PENDING_REVIEW,
    toStatus: EnrollmentStatus.APPROVED,
    allowedOperations: ['approve'],
    errorMessage: '待审核状态下只能执行通过操作'
  },
  {
    entityType: 'enrollment',
    fromStatus: EnrollmentStatus.PENDING_REVIEW,
    toStatus: EnrollmentStatus.REJECTED,
    allowedOperations: ['reject'],
    errorMessage: '待审核状态下只能执行拒绝操作'
  },
  {
    entityType: 'enrollment',
    fromStatus: EnrollmentStatus.PENDING_REVIEW,
    toStatus: EnrollmentStatus.CANCELLED,
    allowedOperations: ['cancel'],
    errorMessage: '待审核状态下只能执行取消操作'
  },
  {
    entityType: 'enrollment',
    fromStatus: EnrollmentStatus.APPROVED,
    toStatus: EnrollmentStatus.CANCELLED,
    allowedOperations: ['cancel'],
    errorMessage: '已通过状态下只能执行取消操作'
  }
];

export interface TransitionContext {
  entityId: string;
  operator?: string;
  notes?: string;
  additionalData?: Record<string, unknown>;
}

export function validateStateTransition(
  entityType: 'batch' | 'enrollment',
  fromStatus: string,
  toStatus: string,
  operation: string
): OperationResult<void> {
  const transitions = entityType === 'batch' ? BATCH_STATUS_TRANSITIONS : ENROLLMENT_STATUS_TRANSITIONS;

  const rule = transitions.find(
    t => t.entityType === entityType && t.fromStatus === fromStatus && t.toStatus === toStatus
  );

  if (!rule) {
    return {
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `不允许从状态「${fromStatus}」流转到「${toStatus}」`,
        details: {
          entityType,
          fromStatus,
          toStatus,
          operation
        }
      }
    };
  }

  if (!rule.allowedOperations.includes(operation)) {
    return {
      success: false,
      error: {
        code: 'INVALID_OPERATION',
        message: `状态「${fromStatus}」下不允许执行「${operation}」操作`,
        details: {
          entityType,
          fromStatus,
          toStatus,
          operation,
          allowedOperations: rule.allowedOperations
        }
      }
    };
  }

  return { success: true };
}

export function createEventRecord(
  entityType: 'batch' | 'enrollment' | 'execution' | 'settlement',
  eventType: string,
  context: TransitionContext,
  fromStatus?: string,
  toStatus?: string,
  additionalPayload: Record<string, unknown> = {}
): EventRecord {
  return {
    id: uuidv4(),
    batchId: entityType === 'batch' ? context.entityId : undefined,
    enrollmentId: entityType !== 'batch' ? context.entityId : undefined,
    entityType,
    eventType,
    fromStatus,
    toStatus,
    payload: {
      operation: eventType,
      operator: context.operator,
      notes: context.notes,
      ...context.additionalData,
      ...additionalPayload
    },
    timestamp: new Date(),
    operator: context.operator,
    notes: context.notes
  };
}

export function getAvailableOperations(
  entityType: 'batch' | 'enrollment',
  currentStatus: string
): string[] {
  const transitions = entityType === 'batch' ? BATCH_STATUS_TRANSITIONS : ENROLLMENT_STATUS_TRANSITIONS;

  const operations = new Set<string>();
  transitions
    .filter(t => t.entityType === entityType && t.fromStatus === currentStatus)
    .forEach(t => t.allowedOperations.forEach(op => operations.add(op)));

  return Array.from(operations);
}

export function canPerformOperation(
  entityType: 'batch' | 'enrollment',
  currentStatus: string,
  operation: string
): boolean {
  const transitions = entityType === 'batch' ? BATCH_STATUS_TRANSITIONS : ENROLLMENT_STATUS_TRANSITIONS;

  return transitions.some(
    t => t.entityType === entityType && t.fromStatus === currentStatus && t.allowedOperations.includes(operation)
  );
}
