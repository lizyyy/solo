import { WorkRecord, BillingResult } from '../types';
export declare class BillingService {
    calculateAndUpdateRecord(recordId: string, operator: string): BillingResult | null;
    calculateAllPending(operator: string): BillingResult[];
    billRecords(recordIds: string[], operator: string): {
        success: string[];
        failed: string[];
    };
    billAllValid(operator: string): {
        success: string[];
        failed: string[];
    };
    reviewRecord(recordId: string, operator: string, notes: string, approve: boolean): WorkRecord | null;
    getBillSummary(filter?: {
        startDate?: Date;
        endDate?: Date;
        operator?: string;
    }): {
        totalBilled: number;
        totalAmount: number;
        byOperator: Record<string, number>;
        byTractor: Record<string, number>;
    };
    getAuditLogs(filter?: {
        recordId?: string;
        action?: string;
        operator?: string;
    }): import("../types").AuditLog[];
}
export declare const billingService: BillingService;
