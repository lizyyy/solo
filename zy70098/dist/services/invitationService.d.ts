import { InvitationBatch, Enrollment, ExecutionRecord, SettlementResult, OperationResult, EventRecord } from '../types';
import { DatabaseService } from '../database/database';
import { calculateDeviation, validateExecutionRecords } from '../core/deviationCalculator';
import { calculateSettlementSummary } from '../core/settlementCalculator';
import { replayEvents } from '../core/eventReplay';
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
export declare class InvitationService {
    private db;
    constructor(db: DatabaseService);
    createBatch(input: CreateBatchInput, operator?: string): OperationResult<InvitationBatch>;
    publishBatch(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    startEnrollment(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    closeEnrollment(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    startExecution(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    completeExecution(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    startSettlement(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    completeSettlement(batchId: string, operator?: string): OperationResult<InvitationBatch>;
    private transitionBatchStatus;
    createEnrollment(input: CreateEnrollmentInput, operator?: string): OperationResult<Enrollment>;
    reviewEnrollment(input: ReviewEnrollmentInput): OperationResult<Enrollment>;
    submitExecutionRecord(input: SubmitExecutionInput, operator?: string): OperationResult<ExecutionRecord>;
    calculateDeviationForEnrollment(enrollmentId: string): OperationResult<{
        deviationResult: ReturnType<typeof calculateDeviation>['data'];
        validation: ReturnType<typeof validateExecutionRecords>;
    }>;
    calculateSettlementForEnrollment(enrollmentId: string, operator?: string): OperationResult<SettlementResult>;
    calculateSettlementForBatch(batchId: string, operator?: string): OperationResult<{
        results: SettlementResult[];
        summary: ReturnType<typeof calculateSettlementSummary>;
    }>;
    getBatchSummary(batchId: string): OperationResult<BatchSummary>;
    replayBatchEvents(batchId: string): OperationResult<ReturnType<typeof replayEvents>['data']>;
    getBatch(batchId: string): InvitationBatch | undefined;
    getAllBatches(): InvitationBatch[];
    getEnrollment(enrollmentId: string): Enrollment | undefined;
    getEnrollmentsByBatch(batchId: string): Enrollment[];
    getExecutionRecords(enrollmentId: string): ExecutionRecord[];
    getSettlementResult(enrollmentId: string): SettlementResult | undefined;
    getEventsByBatch(batchId: string): EventRecord[];
    getEventsByEnrollment(enrollmentId: string): EventRecord[];
}
