import { ChangeHistory } from '../types';
export declare class ChangeHistoryService {
    private store;
    constructor();
    recordChange(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string, oldValue: string, newValue: string, changedBy: string, changeReason?: string): ChangeHistory;
    getHistoryForTrackRemark(remarkId: string): ChangeHistory[];
    getHistoryForApprovalRecord(approvalId: string): ChangeHistory[];
    getHistoryForTrackAlias(aliasId: string): ChangeHistory[];
    getDiffForEntity(entityType: ChangeHistory['entityType'], entityId: string): Array<{
        fieldName: string;
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
        changeReason?: string;
    }>;
    compareFieldChanges(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string): Array<{
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
    }>;
}
