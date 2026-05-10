import { FalsePositiveWaive } from '../types';
export interface CreateWaiveRequest {
    ruleVersionId: string;
    batchId: string;
    reason: string;
    waivedBy: string;
    affectedRows?: number;
}
export declare function createFalsePositiveWaive(request: CreateWaiveRequest): Promise<FalsePositiveWaive>;
export declare function getWaiveById(id: string): Promise<FalsePositiveWaive | null>;
export declare function listWaivesByRuleVersion(ruleVersionId: string, options?: {
    page?: number;
    pageSize?: number;
}): Promise<{
    waives: FalsePositiveWaive[];
    total: number;
}>;
export declare function listWaivesByBatch(batchId: string): Promise<FalsePositiveWaive[]>;
//# sourceMappingURL=falsePositiveWaiveService.d.ts.map