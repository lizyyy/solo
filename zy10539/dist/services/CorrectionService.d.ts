import type { CorrectionRequest, TagDiff, CostImpact, ExceptionRecord, CreateCorrectionRequest } from '../types';
export declare class CorrectionService {
    createCorrection(request: CreateCorrectionRequest): Promise<CorrectionRequest>;
    getCorrection(id: string): Promise<CorrectionRequest | undefined>;
    listCorrections(filters?: {
        status?: string;
        applicant?: string;
        department?: string;
    }): Promise<CorrectionRequest[]>;
    generatePreview(correctionId: string): Promise<{
        tagDiffs: TagDiff[];
        costImpacts: CostImpact[];
    }>;
    submitForApproval(correctionId: string, approver: string): Promise<CorrectionRequest>;
    approveCorrection(correctionId: string, approver: string, comment?: string): Promise<CorrectionRequest>;
    rejectCorrection(correctionId: string, approver: string, comment: string): Promise<CorrectionRequest>;
    executeCorrection(correctionId: string, operator: string): Promise<CorrectionRequest>;
    rollbackCorrection(correctionId: string, operator: string): Promise<CorrectionRequest>;
    manualFix(correctionId: string, assetId: string, correctedTags: Record<string, string>, operator: string, reason: string): Promise<CorrectionRequest>;
    resolveException(exceptionId: string, resolver: string, resolution: string): Promise<ExceptionRecord>;
    private calculateTagDiff;
    private calculateCostImpact;
    private createRollbackPoint;
    private recordException;
    private mockGetCurrentTags;
    private mockGetOriginalCostProject;
    private mockGetAssetCost;
    private simulateTagUpdate;
}
export declare const correctionService: CorrectionService;
