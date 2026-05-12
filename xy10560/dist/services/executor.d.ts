import { DataStore } from '../store/store';
import { ImportData, ExecutionRecord, Certificate } from '../types';
export declare class Executor {
    private store;
    private rules;
    constructor(store: DataStore);
    importData(data: ImportData, operator: string, options?: {
        overwrite?: boolean;
        idempotencyKey?: string;
    }): {
        success: boolean;
        imported: {
            certificates: number;
            domains: number;
            dependencies: number;
            windows: number;
        };
        duplicates: {
            serialNumbers: string[];
            domains: string[];
        };
        errors: string[];
        executionRecord: ExecutionRecord;
    };
    rotateCertificate(certId: string, operator: string, newCertData?: Partial<Certificate>, options?: {
        idempotencyKey?: string;
    }): {
        success: boolean;
        cert: Certificate | null;
        errors: string[];
        executionRecord: ExecutionRecord;
    };
    manualEdit(targetType: 'certificate' | 'dependency' | 'window', targetId: string, updates: Record<string, unknown>, operator: string, reason: string): {
        success: boolean;
        errors: string[];
        executionRecord: ExecutionRecord;
    };
    rollbackCertificate(certId: string, operator: string): {
        success: boolean;
        cert: Certificate | null;
        errors: string[];
        executionRecord: ExecutionRecord;
    };
}
