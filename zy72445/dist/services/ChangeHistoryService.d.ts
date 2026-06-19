import { ChangeHistory } from '../types';
export declare class ChangeHistoryService {
    private store;
    constructor();
    recordChange(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string, oldValue: string, newValue: string, changedBy: string, changeReason?: string, importBatchId?: string, affectedEntityType?: 'approval_record' | 'track_alias', affectedEntityId?: string, snapshotId?: string): ChangeHistory;
    getHistoryForTrackRemark(remarkId: string): ChangeHistory[];
    getHistoryForApprovalRecord(approvalId: string): ChangeHistory[];
    getHistoryForTrackAlias(aliasId: string): ChangeHistory[];
    getHistoryByImportBatch(importBatchId: string): ChangeHistory[];
    getHistoryByAffectedEntity(entityType: 'approval_record' | 'track_alias', entityId: string): ChangeHistory[];
    getDiffForEntity(entityType: ChangeHistory['entityType'], entityId: string): Array<{
        entityType: ChangeHistory['entityType'];
        entityId: string;
        fieldName: string;
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
        changeReason?: string;
        importBatchId?: string;
        affectedEntityType?: 'approval_record' | 'track_alias';
        affectedEntityId?: string;
        snapshotId?: string;
    }>;
    compareFieldChanges(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string): Array<{
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
        importBatchId?: string;
    }>;
}
