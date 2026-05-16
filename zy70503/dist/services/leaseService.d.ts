import { LeaseStatus, CreateLeaseRequest, QueryLeaseRequest, StatusAdvanceRequest, RenewalRequest, ManualCorrectionRequest } from '../types';
export declare class LeaseService {
    createLease(request: CreateLeaseRequest): Promise<{
        success: boolean;
        data: import("../types").PermissionLease;
        isIdempotent: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
        isIdempotent?: undefined;
    }>;
    queryLeases(request: QueryLeaseRequest): Promise<{
        success: boolean;
        data: import("../types").PermissionLease[];
        total: number;
        page: number;
        pageSize: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
        total?: undefined;
        page?: undefined;
        pageSize?: undefined;
    }>;
    getLeaseDetail(leaseId: string): Promise<{
        success: boolean;
        data: {
            lease: import("../types").PermissionLease;
            renewalRecords: import("../types").RenewalRecord[];
            auditLogs: import("../types").AuditLog[];
        };
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
    }>;
    advanceStatus(request: StatusAdvanceRequest): Promise<{
        success: boolean;
        data: {
            statusBefore: LeaseStatus;
            statusAfter: LeaseStatus;
        };
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
    }>;
    requestRenewal(request: RenewalRequest): Promise<{
        success: boolean;
        data: import("../types").RenewalRecord;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
    }>;
    approveRenewal(renewalId: string, approver: string, approved: boolean): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
    }>;
    handleExpiredLeases(): Promise<{
        success: boolean;
        data: {
            leaseId: string;
            result: {
                success: boolean;
                data: {
                    statusBefore: LeaseStatus;
                    statusAfter: LeaseStatus;
                };
                message: string;
                error?: undefined;
            } | {
                success: boolean;
                error: any;
                message: string;
                data?: undefined;
            };
        }[];
        processedCount: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
        processedCount?: undefined;
    }>;
    manualCorrection(request: ManualCorrectionRequest): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
    }>;
    exportLeases(params: {
        accountName?: string;
        status?: LeaseStatus;
        startTime?: number;
        endTime?: number;
    }): Promise<{
        success: boolean;
        data: {
            lease: import("../types").PermissionLease;
            auditLogs: {
                id: string;
                operationType: string;
                operator: string;
                originalInput: any;
                processingBasis: string;
                finalConclusion: string;
                statusBefore: LeaseStatus;
                statusAfter: LeaseStatus;
                createdAt: number;
            }[];
        }[];
        count: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message: string;
        data?: undefined;
        count?: undefined;
    }>;
}
export declare const leaseService: LeaseService;
