import { CacheExplanation, CacheExplanationStatus, CreateExplanationRequest, QueryExplanationParams, ManualCorrectionRequest, ForceRefreshRequest } from '../types';
declare class CacheExplanationStore {
    private explanations;
    create(request: CreateExplanationRequest): CacheExplanation;
    findById(id: string): CacheExplanation | undefined;
    findByCacheKey(cacheKey: string): CacheExplanation | undefined;
    query(params: QueryExplanationParams): {
        data: CacheExplanation[];
        total: number;
    };
    updateStatus(id: string, status: CacheExplanationStatus, updatedBy?: string): CacheExplanation | undefined;
    manualCorrection(request: ManualCorrectionRequest): CacheExplanation | undefined;
    recordHit(cacheKey: string, requestId: string, clientIp?: string): CacheExplanation | undefined;
    forceRefresh(request: ForceRefreshRequest): CacheExplanation | undefined;
    recordFailure(id: string, rawInput: Record<string, unknown>, processingBasis: string[], finalConclusion: string, errorStack?: string): CacheExplanation | undefined;
    getAllForExport(): CacheExplanation[];
}
export declare const cacheExplanationStore: CacheExplanationStore;
export {};
