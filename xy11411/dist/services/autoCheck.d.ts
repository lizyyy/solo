import { StateManager } from './stateManager';
import { TeaMaterialRecord } from '../models/types';
export declare class AutoCheckService {
    private stateManager;
    constructor(stateManager: StateManager);
    checkDuplicateImport(filePath: string): Promise<{
        isDuplicate: boolean;
        existingBatch?: any;
        message: string;
    }>;
    checkPermission(action: string, resource: string): Promise<boolean>;
    validateRecordIntegrity(record: TeaMaterialRecord): Promise<{
        valid: boolean;
        issues: string[];
    }>;
    checkDataConsistency(): Promise<{
        consistent: boolean;
        inconsistencies: Array<{
            type: string;
            recordId?: string;
            message: string;
        }>;
    }>;
    detectAnomalies(record: TeaMaterialRecord): Promise<Array<{
        type: string;
        severity: 'low' | 'medium' | 'high';
        message: string;
        details?: Record<string, any>;
    }>>;
    runAllChecks(): Promise<{
        summary: Record<string, any>;
        details: any;
    }>;
    verifyRestartConsistency(): Promise<{
        consistent: boolean;
        issues: string[];
    }>;
}
