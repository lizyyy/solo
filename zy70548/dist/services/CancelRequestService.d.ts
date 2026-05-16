import { CancelRequest, CancelReport, CreateCancelRequestRequest, ManualCorrectionRequest, UpdateStatusRequest, QueryParams, PaginatedResult } from '../types';
export declare class CancelRequestService {
    private store;
    createCancelRequest(request: CreateCancelRequestRequest): Promise<CancelRequest>;
    getCancelRequest(requestId: string): Promise<CancelRequest | undefined>;
    queryCancelRequests(params: QueryParams): Promise<PaginatedResult<CancelRequest>>;
    updateStatus(requestId: string, updateRequest: UpdateStatusRequest): Promise<CancelRequest | undefined>;
    confirmCancelRequest(requestId: string, operator: string): Promise<CancelRequest | undefined>;
    processCancelRequest(requestId: string): Promise<CancelRequest | undefined>;
    cancelPendingTasks(requestId: string): Promise<{
        intercepted: number;
        canceled: number;
        protected: number;
    }>;
    manualCorrection(requestId: string, correction: ManualCorrectionRequest): Promise<CancelRequest | undefined>;
    recordFailurePath(requestId: string, originalInput: unknown, processingBasis: string, conclusion: string): Promise<void>;
    generateCancelReport(request: CancelRequest): Promise<CancelReport>;
    private getTaskAction;
    private getTaskActionReason;
    private generateSummary;
    private validateStatusTransition;
    addOperatorNote(requestId: string, operator: string, note: string): Promise<CancelRequest | undefined>;
}
export declare const cancelRequestService: CancelRequestService;
