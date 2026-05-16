import { PermissionLease, RenewalRecord, AuditLog, LeaseStatus, RenewalStatus } from '../types';
export declare class Database {
    private db;
    constructor(dbPath?: string);
    private initTables;
    createLease(lease: Omit<PermissionLease, 'id' | 'createdAt' | 'updatedAt'>): Promise<PermissionLease>;
    findLeaseByIdempotencyKey(key: string): Promise<PermissionLease | null>;
    findLeaseById(id: string): Promise<PermissionLease | null>;
    queryLeases(params: {
        accountName?: string;
        status?: LeaseStatus;
        startTime?: number;
        endTime?: number;
        page?: number;
        pageSize?: number;
    }): Promise<{
        data: PermissionLease[];
        total: number;
    }>;
    updateLeaseStatus(id: string, status: LeaseStatus, additionalFields?: {
        recyclingConclusion?: string;
        blockedReason?: string;
    }): Promise<void>;
    manualUpdateLease(id: string, updates: Partial<PermissionLease>): Promise<void>;
    createRenewalRecord(record: Omit<RenewalRecord, 'id' | 'createdAt'>): Promise<RenewalRecord>;
    getRenewalRecordsByLeaseId(leaseId: string): Promise<RenewalRecord[]>;
    findRenewalRecordById(id: string): Promise<RenewalRecord | null>;
    updateRenewalStatus(id: string, status: RenewalStatus, approver: string): Promise<void>;
    createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;
    getAuditLogsByLeaseId(leaseId: string): Promise<AuditLog[]>;
    getExpiredLeases(): Promise<PermissionLease[]>;
    getAllLeasesForExport(params: {
        accountName?: string;
        status?: LeaseStatus;
        startTime?: number;
        endTime?: number;
    }): Promise<PermissionLease[]>;
    close(): void;
}
export declare const db: Database;
