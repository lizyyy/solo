export interface AuditLogOptions {
    batchId?: string;
    recordId?: string;
    operator: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    ip?: string;
}
export declare function logAudit(options: AuditLogOptions): void;
export declare function getAuditLogsByBatch(batchId: string, limit?: number): any[];
export declare function getAuditLogsByRecord(recordId: string, limit?: number): any[];
export declare function getAuditLogsByOperator(operator: string, limit?: number): any[];
export declare function getAllAuditLogs(limit?: number): any[];
export declare function getRecordChangeHistory(recordId: string): any[];
