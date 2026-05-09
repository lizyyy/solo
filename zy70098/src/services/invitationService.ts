import { v4 as uuidv4 } from 'uuid';
import {
  InvitationBatch, InvitationBatchStatus, Enrollment, EnrollmentStatus,
  ExecutionRecord, SettlementResult, SettlementStatus, OperationResult,
  EventRecord
} from '../types';
import { DatabaseService } from '../database/database';
import {
  validateStateTransition, createEventRecord, getAvailableOperations,
  TransitionContext
} from '../core/stateMachine';
import {
  calculateDeviation, validateExecutionRecords,
  DEFAULT_DEVIATION_CONFIG
} from '../core/deviationCalculator';
import {
  calculateSettlementAmount, determineSettlementStatus,
  calculateSettlementSummary, DEFAULT_SETTLEMENT_CONFIG
} from '../core/settlementCalculator';
import { replayEvents, getEventTimeline } from '../core/eventReplay';

export interface CreateBatchInput {
  name: string;
  description: string;
  targetPeakLoad: number;
  unitPrice: number;
  enrollmentStartTime: Date;
  enrollmentEndTime: Date;
  executionStartTime: Date;
  executionEndTime: Date;
}

export interface CreateEnrollmentInput {
  batchId: string;
  enterpriseId: string;
  enterpriseName: string;
  declaredCapacity: number;
  minimumGuaranteedCapacity?: number;
  contactName: string;
  contactPhone: string;
}

export interface ReviewEnrollmentInput {
  enrollmentId: string;
  approved: boolean;
  reviewComment?: string;
  operator?: string;
}

export interface SubmitExecutionInput {
  batchId: string;
  enrollmentId: string;
  enterpriseId: string;
  timestamp: Date;
  baselineLoad: number;
  actualLoad: number;
  sourceSystem: string;
}

export interface BatchSummary {
  batch: InvitationBatch;
  enrollments: Array<{
    enrollment: Enrollment;
    executionCount: number;
    settlementResult?: SettlementResult;
  }>;
  settlementSummary?: {
    totalEnrollments: number;
    passedEnrollments: number;
    failedEnrollments: number;
    totalSettlementAmount: number;
    totalReductionAmount: number;
    averageDeviationRate: number;
  };
  eventTimeline: Array<{
    time: Date;
    eventType: string;
    entityType: string;
    fromStatus?: string;
    toStatus?: string;
    operator?: string;
  }>;
}

export class InvitationService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  createBatch(input: CreateBatchInput, operator?: string): OperationResult<InvitationBatch> {
    if (input.targetPeakLoad <= 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_TARGET_PEAK_LOAD',
          message: '目标削峰容量必须大于 0',
          details: { targetPeakLoad: input.targetPeakLoad }
        }
      };
    }

    if (input.unitPrice <= 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_UNIT_PRICE',
          message: '单位补贴价格必须大于 0',
          details: { unitPrice: input.unitPrice }
        }
      };
    }

    if (input.enrollmentEndTime <= input.enrollmentStartTime) {
      return {
        success: false,
        error: {
          code: 'INVALID_ENROLLMENT_TIME',
          message: '报名结束时间必须晚于报名开始时间',
          details: {
            enrollmentStartTime: input.enrollmentStartTime,
            enrollmentEndTime: input.enrollmentEndTime
          }
        }
      };
    }

    if (input.executionEndTime <= input.executionStartTime) {
      return {
        success: false,
        error: {
          code: 'INVALID_EXECUTION_TIME',
          message: '执行结束时间必须晚于执行开始时间',
          details: {
            executionStartTime: input.executionStartTime,
            executionEndTime: input.executionEndTime
          }
        }
      };
    }

    const now = new Date();
    const batch: InvitationBatch = {
      id: uuidv4(),
      ...input,
      status: InvitationBatchStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    const saved = this.db.saveBatch(batch);

    const event = createEventRecord(
      'batch',
      'create',
      { entityId: saved.id, operator },
      undefined,
      InvitationBatchStatus.DRAFT,
      { ...input }
    );
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  publishBatch(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.PUBLISHED,
      'publish',
      operator
    );
  }

  startEnrollment(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.ENROLLMENT_STARTED,
      'start_enrollment',
      operator
    );
  }

  closeEnrollment(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.ENROLLMENT_CLOSED,
      'close_enrollment',
      operator
    );
  }

  startExecution(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.EXECUTION_STARTED,
      'start_execution',
      operator
    );
  }

  completeExecution(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.EXECUTION_COMPLETED,
      'complete_execution',
      operator
    );
  }

  startSettlement(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.SETTLEMENT_STARTED,
      'start_settlement',
      operator
    );
  }

  completeSettlement(batchId: string, operator?: string): OperationResult<InvitationBatch> {
    return this.transitionBatchStatus(
      batchId,
      InvitationBatchStatus.SETTLEMENT_COMPLETED,
      'complete_settlement',
      operator
    );
  }

  private transitionBatchStatus(
    batchId: string,
    toStatus: InvitationBatchStatus,
    operation: string,
    operator?: string
  ): OperationResult<InvitationBatch> {
    const batch = this.db.getBatch(batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId }
        }
      };
    }

    const transitionResult = validateStateTransition(
      'batch',
      batch.status,
      toStatus,
      operation
    );

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error
      };
    }

    const context: TransitionContext = {
      entityId: batchId,
      operator,
      additionalData: {
        availableOperations: getAvailableOperations('batch', batch.status)
      }
    };

    const event = createEventRecord(
      'batch',
      operation,
      context,
      batch.status,
      toStatus
    );

    batch.status = toStatus;
    batch.updatedAt = new Date();

    const saved = this.db.saveBatch(batch, batch.version);
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  createEnrollment(input: CreateEnrollmentInput, operator?: string): OperationResult<Enrollment> {
    const batch = this.db.getBatch(input.batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId: input.batchId }
        }
      };
    }

    if (batch.status !== InvitationBatchStatus.ENROLLMENT_STARTED) {
      return {
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_OPEN',
          message: '该批次当前不在报名阶段',
          details: { batchStatus: batch.status }
        }
      };
    }

    const existing = this.db.getEnrollmentByBatchAndEnterprise(
      input.batchId,
      input.enterpriseId
    );
    if (existing) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_ENROLLMENT',
          message: '该企业已在此批次报名，不允许重复提交',
          details: {
            batchId: input.batchId,
            enterpriseId: input.enterpriseId,
            existingEnrollmentId: existing.id
          }
        }
      };
    }

    if (input.declaredCapacity <= 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_DECLARED_CAPACITY',
          message: '申报容量必须大于 0',
          details: { declaredCapacity: input.declaredCapacity }
        }
      };
    }

    const now = new Date();
    const enrollment: Enrollment = {
      id: uuidv4(),
      ...input,
      status: EnrollmentStatus.PENDING_REVIEW,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    const saved = this.db.saveEnrollment(enrollment);

    const event = createEventRecord(
      'enrollment',
      'create',
      { entityId: saved.id, operator },
      undefined,
      EnrollmentStatus.PENDING_REVIEW,
      { ...input }
    );
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  reviewEnrollment(input: ReviewEnrollmentInput): OperationResult<Enrollment> {
    const enrollment = this.db.getEnrollment(input.enrollmentId);
    if (!enrollment) {
      return {
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          message: '报名记录不存在',
          details: { enrollmentId: input.enrollmentId }
        }
      };
    }

    const toStatus = input.approved ? EnrollmentStatus.APPROVED : EnrollmentStatus.REJECTED;
    const operation = input.approved ? 'approve' : 'reject';

    const transitionResult = validateStateTransition(
      'enrollment',
      enrollment.status,
      toStatus,
      operation
    );

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error
      };
    }

    const event = createEventRecord(
      'enrollment',
      operation,
      {
        entityId: enrollment.id,
        operator: input.operator,
        notes: input.reviewComment
      },
      enrollment.status,
      toStatus,
      { reviewComment: input.reviewComment }
    );

    enrollment.status = toStatus;
    enrollment.reviewComment = input.reviewComment;
    enrollment.reviewedAt = new Date();
    enrollment.updatedAt = new Date();

    const saved = this.db.saveEnrollment(enrollment, enrollment.version);
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  submitExecutionRecord(input: SubmitExecutionInput, operator?: string): OperationResult<ExecutionRecord> {
    const batch = this.db.getBatch(input.batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId: input.batchId }
        }
      };
    }

    if (batch.status !== InvitationBatchStatus.EXECUTION_STARTED) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_NOT_ACTIVE',
          message: '该批次当前不在执行阶段',
          details: { batchStatus: batch.status }
        }
      };
    }

    const enrollment = this.db.getEnrollment(input.enrollmentId);
    if (!enrollment) {
      return {
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          message: '报名记录不存在',
          details: { enrollmentId: input.enrollmentId }
        }
      };
    }

    if (enrollment.status !== EnrollmentStatus.APPROVED) {
      return {
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_APPROVED',
          message: '只有已通过的报名才能提交执行记录',
          details: { enrollmentStatus: enrollment.status }
        }
      };
    }

    if (input.baselineLoad < 0 || input.actualLoad < 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOAD_VALUE',
          message: '负荷值不能为负数',
          details: {
            baselineLoad: input.baselineLoad,
            actualLoad: input.actualLoad
          }
        }
      };
    }

    const record: ExecutionRecord = {
      id: uuidv4(),
      ...input,
      createdAt: new Date(),
      version: 1
    };

    const saved = this.db.saveExecutionRecord(record);

    const event = createEventRecord(
      'execution',
      'submit',
      { entityId: enrollment.id, operator },
      undefined,
      undefined,
      { ...input }
    );
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  calculateDeviationForEnrollment(enrollmentId: string): OperationResult<{
    deviationResult: ReturnType<typeof calculateDeviation>['data'];
    validation: ReturnType<typeof validateExecutionRecords>;
  }> {
    const enrollment = this.db.getEnrollment(enrollmentId);
    if (!enrollment) {
      return {
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          message: '报名记录不存在',
          details: { enrollmentId }
        }
      };
    }

    const batch = this.db.getBatch(enrollment.batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId: enrollment.batchId }
        }
      };
    }

    const records = this.db.getExecutionRecordsByEnrollment(enrollmentId);
    const validation = validateExecutionRecords(
      records,
      batch.executionStartTime,
      batch.executionEndTime
    );

    if (!validation.isValid) {
      return {
        success: false,
        error: {
          code: 'INVALID_EXECUTION_RECORDS',
          message: '执行记录验证失败',
          details: { errors: validation.errors }
        }
      };
    }

    const deviationResult = calculateDeviation(
      records,
      enrollment.declaredCapacity,
      DEFAULT_DEVIATION_CONFIG
    );

    if (!deviationResult.success) {
      return deviationResult as any;
    }

    return {
      success: true,
      data: {
        deviationResult: deviationResult.data,
        validation
      }
    };
  }

  calculateSettlementForEnrollment(
    enrollmentId: string,
    operator?: string
  ): OperationResult<SettlementResult> {
    const deviationResult = this.calculateDeviationForEnrollment(enrollmentId);
    if (!deviationResult.success) {
      return deviationResult as any;
    }

    const enrollment = this.db.getEnrollment(enrollmentId);
    const batch = this.db.getBatch(enrollment!.batchId);

    const settlementInput = {
      enrollmentId,
      batchId: enrollment!.batchId,
      enterpriseId: enrollment!.enterpriseId,
      deviationResult: deviationResult.data!.deviationResult!,
      unitPrice: batch!.unitPrice,
      config: DEFAULT_SETTLEMENT_CONFIG
    };

    const calculationResult = calculateSettlementAmount(settlementInput);
    if (!calculationResult.success) {
      return calculationResult as any;
    }

    const hasErrors = !deviationResult.data!.validation.isValid ||
      deviationResult.data!.validation.errors.length > 0;

    const status = determineSettlementStatus(
      deviationResult.data!.deviationResult!,
      hasErrors
    );

    const now = new Date();
    const settlement: SettlementResult = {
      id: uuidv4(),
      enrollmentId,
      batchId: enrollment!.batchId,
      enterpriseId: enrollment!.enterpriseId,
      settlementAmount: calculationResult.data!.settlementAmount,
      deviationRate: calculationResult.data!.deviationRate,
      reductionAmount: calculationResult.data!.reductionAmount,
      status,
      settlementTime: status === SettlementStatus.COMPLETED ? now : undefined,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    const saved = this.db.saveSettlementResult(settlement);

    const event = createEventRecord(
      'settlement',
      'calculate',
      { entityId: enrollmentId, operator },
      undefined,
      status,
      {
        settlementAmount: saved.settlementAmount,
        deviationRate: saved.deviationRate,
        reductionAmount: saved.reductionAmount
      }
    );
    this.db.saveEvent(event);

    return {
      success: true,
      data: saved,
      events: [event]
    };
  }

  calculateSettlementForBatch(batchId: string, operator?: string): OperationResult<{
    results: SettlementResult[];
    summary: ReturnType<typeof calculateSettlementSummary>;
  }> {
    const enrollments = this.db.getEnrollmentsByBatch(batchId).filter(
      e => e.status === EnrollmentStatus.APPROVED
    );

    const results: SettlementResult[] = [];
    const errors: string[] = [];

    for (const enrollment of enrollments) {
      const result = this.calculateSettlementForEnrollment(enrollment.id, operator);
      if (result.success && result.data) {
        results.push(result.data);
      } else if (result.error) {
        errors.push(`${enrollment.enterpriseName}: ${result.error.message}`);
      }
    }

    const batch = this.db.getBatch(batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId }
        }
      };
    }

    const summaryResults = results.map(r => ({
      deviationResult: {
        enrollmentId: r.enrollmentId,
        averageBaseline: 0,
        averageActual: 0,
        achievedReduction: r.reductionAmount,
        expectedReduction: 0,
        deviationRate: r.deviationRate,
        passThreshold: DEFAULT_DEVIATION_CONFIG.passThreshold,
        isPassed: r.status === SettlementStatus.COMPLETED,
        calculatedAt: new Date()
      },
      settlementAmount: r.settlementAmount,
      reductionAmount: r.reductionAmount
    }));

    const summary = calculateSettlementSummary(summaryResults);

    return {
      success: errors.length === 0 || results.length > 0,
      data: {
        results,
        summary
      },
      error: errors.length > 0 ? {
        code: 'PARTIAL_SETTLEMENT_ERRORS',
        message: '部分企业结算失败',
        details: { errors }
      } : undefined
    };
  }

  getBatchSummary(batchId: string): OperationResult<BatchSummary> {
    const batch = this.db.getBatch(batchId);
    if (!batch) {
      return {
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: '邀约批次不存在',
          details: { batchId }
        }
      };
    }

    const enrollments = this.db.getEnrollmentsByBatch(batchId);
    const settlementResults = this.db.getSettlementResultsByBatch(batchId);

    const enrollmentDetails = enrollments.map(e => {
      const executions = this.db.getExecutionRecordsByEnrollment(e.id);
      const settlement = settlementResults.find(s => s.enrollmentId === e.id);

      return {
        enrollment: e,
        executionCount: executions.length,
        settlementResult: settlement
      };
    });

    const events = this.db.getEventsByBatch(batchId);
    const timeline = getEventTimeline(events);

    const summaryData = settlementResults.map(r => ({
      deviationResult: {
        enrollmentId: r.enrollmentId,
        averageBaseline: 0,
        averageActual: 0,
        achievedReduction: r.reductionAmount,
        expectedReduction: 0,
        deviationRate: r.deviationRate,
        passThreshold: DEFAULT_DEVIATION_CONFIG.passThreshold,
        isPassed: r.status === SettlementStatus.COMPLETED,
        calculatedAt: new Date()
      },
      settlementAmount: r.settlementAmount,
      reductionAmount: r.reductionAmount
    }));

    const summary = summaryData.length > 0 ? calculateSettlementSummary(summaryData) : undefined;

    return {
      success: true,
      data: {
        batch,
        enrollments: enrollmentDetails,
        settlementSummary: summary,
        eventTimeline: timeline
      }
    };
  }

  replayBatchEvents(batchId: string): OperationResult<ReturnType<typeof replayEvents>['data']> {
    const events = this.db.getEventsByBatch(batchId);
    return replayEvents(events);
  }

  getBatch(batchId: string): InvitationBatch | undefined {
    return this.db.getBatch(batchId);
  }

  getAllBatches(): InvitationBatch[] {
    return this.db.getAllBatches();
  }

  getEnrollment(enrollmentId: string): Enrollment | undefined {
    return this.db.getEnrollment(enrollmentId);
  }

  getEnrollmentsByBatch(batchId: string): Enrollment[] {
    return this.db.getEnrollmentsByBatch(batchId);
  }

  getExecutionRecords(enrollmentId: string): ExecutionRecord[] {
    return this.db.getExecutionRecordsByEnrollment(enrollmentId);
  }

  getSettlementResult(enrollmentId: string): SettlementResult | undefined {
    return this.db.getSettlementResult(enrollmentId);
  }

  getEventsByBatch(batchId: string): EventRecord[] {
    return this.db.getEventsByBatch(batchId);
  }

  getEventsByEnrollment(enrollmentId: string): EventRecord[] {
    return this.db.getEventsByEnrollment(enrollmentId);
  }
}
