import { ConsumptionRecord, AuditLogEntry, RecordStatus } from './types';
export declare function createAuditLog(operator: string, action: string, fieldName?: string, oldValue?: string, newValue?: string, reason?: string): AuditLogEntry;
export declare function addManualEdit(record: ConsumptionRecord, operator: string, fieldName: string, oldValue: string, newValue: string, reason?: string): ConsumptionRecord;
export declare function updateRecordStatus(record: ConsumptionRecord, newStatus: RecordStatus, operator: string, reason?: string): ConsumptionRecord;
export declare function confirmRecord(record: ConsumptionRecord, operator: string, confirm: boolean, reason?: string): ConsumptionRecord;
export declare function confirmTempSubstitute(record: ConsumptionRecord, operator: string, confirm: boolean, reason?: string): ConsumptionRecord;
export declare function settleRecords(records: ConsumptionRecord[], operator: string): ConsumptionRecord[];
export declare function getRecordAuditTrail(record: ConsumptionRecord): any[];
