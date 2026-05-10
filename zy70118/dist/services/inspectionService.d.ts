import { Batch, BatchStatus, RejectionReason, CreateBatchRequest, TemperatureCheckRequest, WeightCheckRequest, TicketCheckRequest, RejectBatchRequest, ReplenishBatchRequest, AcceptBatchRequest, RuleEngine } from '../domain';
import { IBatchRepository } from '../infrastructure/repositories';
export interface InspectionResult<T> {
    success: boolean;
    batch?: Batch;
    data?: T;
    errors?: string[];
    warnings?: string[];
}
export interface InspectionReport {
    batchId: string;
    materialCode: string;
    materialName: string;
    supplierId: string;
    status: BatchStatus;
    temperatureSummary: {
        checked: boolean;
        passed: boolean;
        count: number;
        minTemp?: number;
        maxTemp?: number;
        avgTemp?: number;
    };
    weightSummary: {
        checked: boolean;
        passed: boolean;
        totalExpected: number;
        totalActual: number;
        deviationPercent: number;
    };
    ticketSummary: {
        checked: boolean;
        passed: boolean;
        totalProvided: number;
        totalRequired: number;
    };
    rejectionReasons: RejectionReason[];
    createdAt: Date;
}
export declare class InspectionService {
    private readonly repository;
    private readonly ruleEngine;
    constructor(repository: IBatchRepository, ruleEngine: RuleEngine);
    createBatch(request: CreateBatchRequest): Promise<Batch>;
    performTemperatureCheck(request: TemperatureCheckRequest): Promise<InspectionResult<null>>;
    performWeightCheck(request: WeightCheckRequest): Promise<InspectionResult<null>>;
    performTicketCheck(request: TicketCheckRequest): Promise<InspectionResult<null>>;
    rejectBatch(request: RejectBatchRequest): Promise<InspectionResult<null>>;
    replenishBatch(request: ReplenishBatchRequest): Promise<InspectionResult<null>>;
    acceptBatch(request: AcceptBatchRequest): Promise<InspectionResult<null>>;
    getBatch(batchId: string): Promise<Batch | null>;
    listBatches(filters?: {
        supplierId?: string;
        status?: string;
        materialCode?: string;
    }): Promise<Batch[]>;
    generateReport(batchId: string): Promise<InspectionReport>;
    private getBatchOrThrow;
    private validateCreateBatchRequest;
    private calculateTemperatureSummary;
    private calculateWeightSummary;
    private calculateTicketSummary;
}
