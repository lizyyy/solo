import { CancelRequest, CancelRequestStatus, QueryParams, PaginatedResult, CreateCancelRequestRequest, CancelReason, CancelReport, FailurePath, JobTask } from '../types';
export interface ICancelRequestStore {
    create(request: CreateCancelRequestRequest): Promise<CancelRequest>;
    getById(requestId: string): Promise<CancelRequest | undefined>;
    query(params: QueryParams): Promise<PaginatedResult<CancelRequest>>;
    updateStatus(requestId: string, status: CancelRequestStatus, reason?: CancelReason): Promise<CancelRequest | undefined>;
    updateTask(requestId: string, taskId: string, updates: Partial<JobTask>): Promise<CancelRequest | undefined>;
    addReport(requestId: string, report: CancelReport): Promise<CancelRequest | undefined>;
    addFailurePath(requestId: string, failurePath: FailurePath): Promise<CancelRequest | undefined>;
    addReason(requestId: string, reason: CancelReason): Promise<CancelRequest | undefined>;
    delete(requestId: string): Promise<boolean>;
}
export declare class InMemoryCancelRequestStore implements ICancelRequestStore {
    private requests;
    create(request: CreateCancelRequestRequest): Promise<CancelRequest>;
    getById(requestId: string): Promise<CancelRequest | undefined>;
    query(params: QueryParams): Promise<PaginatedResult<CancelRequest>>;
    updateStatus(requestId: string, status: CancelRequestStatus, reason?: CancelReason): Promise<CancelRequest | undefined>;
    updateTask(requestId: string, taskId: string, updates: Partial<JobTask>): Promise<CancelRequest | undefined>;
    addReport(requestId: string, report: CancelReport): Promise<CancelRequest | undefined>;
    addFailurePath(requestId: string, failurePath: FailurePath): Promise<CancelRequest | undefined>;
    addReason(requestId: string, reason: CancelReason): Promise<CancelRequest | undefined>;
    delete(requestId: string): Promise<boolean>;
}
export declare const cancelRequestStore: InMemoryCancelRequestStore;
