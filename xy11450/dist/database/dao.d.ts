import { ReturnBatch, EquipmentItem, Attachment, AuditLog, FailedRecord, DepositDeduction, ReturnStatus, FinancialSummary } from '../types';
export declare const BatchDAO: {
    create(batch: Omit<ReturnBatch, "id" | "createdAt" | "updatedAt">): Promise<ReturnBatch>;
    findById(id: string): Promise<ReturnBatch | null>;
    findByBatchNo(batchNo: string): Promise<ReturnBatch | null>;
    updateStatus(id: string, status: ReturnStatus, reason: string, operatorId: string, operatorName: string): Promise<void>;
    freeze(id: string, reason: string, operatorId: string, operatorName: string): Promise<void>;
    unfreeze(id: string, reason: string, operatorId: string, operatorName: string): Promise<void>;
    archive(id: string, reason: string, operatorId: string, operatorName: string): Promise<void>;
    updateDeductions(id: string, deductibleAmount: number, finalRefund: number, reason: string, operatorId: string, operatorName: string): Promise<void>;
    findAll(filters?: {
        status?: ReturnStatus;
        customerId?: string;
        isArchived?: boolean;
    }, page?: number, pageSize?: number): Promise<{
        data: ReturnBatch[];
        total: number;
    }>;
    mapRowToBatch(row: any): ReturnBatch;
};
export declare const EquipmentDAO: {
    create(items: Omit<EquipmentItem, "id" | "createdAt" | "updatedAt">[]): Promise<EquipmentItem[]>;
    findByBatchId(batchId: string): Promise<EquipmentItem[]>;
};
export declare const AttachmentDAO: {
    create(attachment: Omit<Attachment, "id" | "uploadedAt">): Promise<Attachment>;
    findByBatchId(batchId: string): Promise<Attachment[]>;
    verify(id: string, verifiedBy: string, notes?: string): Promise<void>;
};
export declare const AuditLogDAO: {
    create(log: Omit<AuditLog, "id">): Promise<AuditLog>;
    findByBatchId(batchId: string): Promise<AuditLog[]>;
};
export declare const FailedRecordDAO: {
    create(record: Omit<FailedRecord, "id" | "failedAt" | "resolved">): Promise<FailedRecord>;
    findAll(resolved?: boolean, page?: number, pageSize?: number): Promise<{
        data: FailedRecord[];
        total: number;
    }>;
    resolve(id: string, resolvedBy: string, notes: string): Promise<void>;
};
export declare const DeductionDAO: {
    create(deduction: Omit<DepositDeduction, "id" | "createdAt" | "isApproved">): Promise<DepositDeduction>;
    findByBatchId(batchId: string): Promise<DepositDeduction[]>;
    approve(id: string, approvedBy: string): Promise<void>;
};
export declare const SummaryDAO: {
    getFinancialSummary(): Promise<FinancialSummary>;
};
