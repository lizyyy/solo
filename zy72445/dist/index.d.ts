import { ApprovalService } from './services/ApprovalService';
import { DataStore } from './store/DataStore';
import { BOUNDARY_RULES } from './constants/boundaryRules';
import { ChangeHistory } from './types';
export declare function runFullDemo(): {
    success: boolean;
    report: {
        exportTime: string;
        batchId: string;
        batchIdentifier: string;
        importedBy: string;
        summary: {
            totalTracks: number;
            newRecords: number;
            thisTimeDuplicates: number;
            historicalDuplicates: number;
            approvalStatuses: Record<string, number>;
            changeHistoryCount: number;
        };
        tracks: any[];
        changeHistory: ChangeHistory[];
    };
    approvalCount: number;
    changeHistoryCount: number;
};
export { ApprovalService, DataStore, BOUNDARY_RULES };
export * from './types';
