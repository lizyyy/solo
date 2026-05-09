import { RevisionRecord, ProductionRecord, WasteRecord, DowntimeRecord } from '../models/types';
export declare class RevisionService {
    reviseProduction(id: string, params: {
        revisedBy: string;
        reason: string;
        changes: {
            quantity?: number;
            shiftId?: string;
        };
    }): ProductionRecord;
    reviseWaste(id: string, params: {
        revisedBy: string;
        reason: string;
        changes: {
            quantity?: number;
            reason?: string;
            shiftId?: string;
        };
    }): WasteRecord;
    reviseDowntime(id: string, params: {
        revisedBy: string;
        reason: string;
        changes: {
            startTime?: Date;
            endTime?: Date;
            reason?: string;
        };
    }): DowntimeRecord;
    getRevisionHistory(targetId: string, targetType: RevisionRecord['targetType']): RevisionRecord[];
    getCurrentVersion(targetId: string, targetType: RevisionRecord['targetType']): number;
    hasRevisions(targetId: string, targetType: RevisionRecord['targetType']): boolean;
}
export declare const revisionService: RevisionService;
//# sourceMappingURL=revisionService.d.ts.map