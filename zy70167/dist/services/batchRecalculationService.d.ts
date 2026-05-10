import { BatchRecalculation, BatchStatus } from '../types';
export interface CreateBatchRequest {
    ruleVersionId: string;
    batchDate: string;
    createdBy: string;
}
export interface UpdateBatchStatusRequest {
    operator: string;
    errorMessage?: string;
    dataCount?: number;
    passCount?: number;
    failCount?: number;
}
export declare function createBatchRecalculation(request: CreateBatchRequest): Promise<BatchRecalculation>;
export declare function findExistingBatch(ruleVersionId: string, batchDate: string): Promise<BatchRecalculation | null>;
export declare function getBatchById(id: string): Promise<BatchRecalculation | null>;
export declare function listBatchesByRuleVersion(ruleVersionId: string, options?: {
    page?: number;
    pageSize?: number;
    status?: BatchStatus;
}): Promise<{
    batches: BatchRecalculation[];
    total: number;
}>;
export declare function startBatch(id: string, operator: string): Promise<BatchRecalculation>;
export declare function completeBatchSuccess(id: string, request: UpdateBatchStatusRequest): Promise<BatchRecalculation>;
export declare function completeBatchFailed(id: string, request: UpdateBatchStatusRequest): Promise<BatchRecalculation>;
//# sourceMappingURL=batchRecalculationService.d.ts.map