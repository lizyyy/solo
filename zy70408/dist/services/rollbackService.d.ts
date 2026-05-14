import { RollbackCandidate } from '../types';
export declare class RollbackService {
    generateRollbackCandidates(recordId: string): Promise<RollbackCandidate[]>;
    getRollbackCandidates(recordId: string): Promise<RollbackCandidate[]>;
    clearRollbackCandidates(recordId: string): Promise<void>;
    executeRollback(recordId: string, candidateIds: string[]): Promise<{
        success: boolean;
        rolledBack: string[];
    }>;
    generateCleanupCandidates(): Promise<{
        expiredRecords: any[];
        orphanedFiles: string[];
        emptyUploads: string[];
    }>;
}
export declare const rollbackService: RollbackService;
