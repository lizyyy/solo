import { AuditLogEntry, ProcessingResult } from '../types';
export declare function logAction(operator: string, action: string, details: Record<string, unknown>, recordId?: string): AuditLogEntry;
export declare function getAuditLog(recordId?: string): AuditLogEntry[];
export declare function generateAuditReport(): ProcessingResult<string>;
