import {
  EventRecord, InvitationBatch, Enrollment, OperationResult
} from '../types';
import { InvitationBatchStatus, EnrollmentStatus } from '../types';

export interface ReplayResult {
  reconstructedBatch?: InvitationBatch;
  reconstructedEnrollments: Enrollment[];
  replayEvents: Array<{
    event: EventRecord;
    applied: boolean;
    changes: Record<string, unknown>;
  }>;
  errors: string[];
}

export interface ReplayContext {
  initialBatch?: InvitationBatch;
  initialEnrollments: Enrollment[];
}

export function replayEvents(
  events: EventRecord[],
  context: ReplayContext = { initialEnrollments: [] }
): OperationResult<ReplayResult> {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let currentBatch: InvitationBatch | undefined = context.initialBatch;
  const currentEnrollments = new Map<string, Enrollment>();
  const replayEvents: ReplayResult['replayEvents'] = [];
  const errors: string[] = [];

  context.initialEnrollments.forEach(e => currentEnrollments.set(e.id, e));

  for (const event of sortedEvents) {
    const result = applyEvent(event, currentBatch, currentEnrollments);

    if (result.success) {
      if (result.batch) {
        currentBatch = result.batch;
      }
      if (result.enrollment && event.enrollmentId) {
        currentEnrollments.set(event.enrollmentId, result.enrollment);
      }

      replayEvents.push({
        event,
        applied: true,
        changes: result.changes || {}
      });
    } else {
      errors.push(`事件 ${event.id} 应用失败: ${result.error?.message || '未知错误'}`);
      replayEvents.push({
        event,
        applied: false,
        changes: {}
      });
    }
  }

  return {
    success: true,
    data: {
      reconstructedBatch: currentBatch,
      reconstructedEnrollments: Array.from(currentEnrollments.values()),
      replayEvents,
      errors
    }
  };
}

interface ApplyEventResult {
  success: boolean;
  batch?: InvitationBatch;
  enrollment?: Enrollment;
  changes?: Record<string, unknown>;
  error?: { code: string; message: string };
}

function applyEvent(
  event: EventRecord,
  currentBatch: InvitationBatch | undefined,
  currentEnrollments: Map<string, Enrollment>
): ApplyEventResult {
  if (event.entityType === 'batch') {
    return applyBatchEvent(event, currentBatch);
  } else if (event.entityType === 'enrollment') {
    return applyEnrollmentEvent(event, currentEnrollments);
  }

  return { success: true };
}

function applyBatchEvent(
  event: EventRecord,
  currentBatch: InvitationBatch | undefined
): ApplyEventResult {
  if (!currentBatch && event.eventType === 'create') {
    const payload = event.payload;
    return {
      success: true,
      batch: {
        id: event.batchId!,
        name: String(payload.name),
        description: String(payload.description),
        targetPeakLoad: Number(payload.targetPeakLoad),
        unitPrice: Number(payload.unitPrice),
        enrollmentStartTime: new Date(String(payload.enrollmentStartTime)),
        enrollmentEndTime: new Date(String(payload.enrollmentEndTime)),
        executionStartTime: new Date(String(payload.executionStartTime)),
        executionEndTime: new Date(String(payload.executionEndTime)),
        status: InvitationBatchStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      } as unknown as InvitationBatch,
      changes: { status: InvitationBatchStatus.DRAFT }
    };
  }

  if (currentBatch) {
    const changes: Record<string, unknown> = {};

    if (event.toStatus) {
      changes.status = event.toStatus;
    }

    if (event.payload.updatedFields && typeof event.payload.updatedFields === 'object') {
      Object.assign(changes, event.payload.updatedFields);
    }

    return {
      success: true,
      batch: {
        ...currentBatch,
        ...changes,
        updatedAt: new Date(),
        version: currentBatch.version + 1
      } as InvitationBatch,
      changes
    };
  }

  return {
    success: false,
    error: { code: 'BATCH_NOT_FOUND', message: '批次不存在，无法应用事件' }
  };
}

function applyEnrollmentEvent(
  event: EventRecord,
  currentEnrollments: Map<string, Enrollment>
): ApplyEventResult {
  if (!event.enrollmentId) {
    return {
      success: false,
      error: { code: 'ENROLLMENT_ID_MISSING', message: '缺少报名 ID' }
    };
  }

  if (event.eventType === 'create') {
    const payload = event.payload;
    const enrollment: Enrollment = {
      id: event.enrollmentId,
      batchId: String(payload.batchId),
      enterpriseId: String(payload.enterpriseId),
      enterpriseName: String(payload.enterpriseName),
      declaredCapacity: Number(payload.declaredCapacity),
      contactName: String(payload.contactName),
      contactPhone: String(payload.contactPhone),
      status: EnrollmentStatus.PENDING_REVIEW,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    return {
      success: true,
      enrollment,
      changes: { status: EnrollmentStatus.PENDING_REVIEW }
    };
  }

  const existing = currentEnrollments.get(event.enrollmentId);
  if (!existing) {
    return {
      success: false,
      error: { code: 'ENROLLMENT_NOT_FOUND', message: '报名记录不存在' }
    };
  }

  const changes: Record<string, unknown> = {};
  if (event.toStatus) {
    changes.status = event.toStatus;
  }
  if (event.payload.updatedFields) {
    Object.assign(changes, event.payload.updatedFields);
  }

  return {
    success: true,
    enrollment: {
      ...existing,
      ...changes,
      updatedAt: new Date(),
      version: existing.version + 1
    } as Enrollment,
    changes
  };
}

export function findEventsByBatch(
  events: EventRecord[],
  batchId: string
): EventRecord[] {
  return events.filter(e => e.batchId === batchId);
}

export function findEventsByEntity(
  events: EventRecord[],
  entityType: 'batch' | 'enrollment' | 'execution' | 'settlement',
  entityId: string
): EventRecord[] {
  return events.filter(e => {
    if (e.entityType === entityType) {
      if (entityType === 'batch') return e.batchId === entityId;
      return e.enrollmentId === entityId;
    }
    return false;
  });
}

export function getEventTimeline(
  events: EventRecord[]
): Array<{
  time: Date;
  eventType: string;
  entityType: string;
  fromStatus?: string;
  toStatus?: string;
  operator?: string;
}> {
  return events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(e => ({
      time: new Date(e.timestamp),
      eventType: e.eventType,
      entityType: e.entityType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      operator: e.operator
    }));
}
