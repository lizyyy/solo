import { DataStore } from '../store/DataStore';
import { ChangeHistory } from '../types';

export class ChangeHistoryService {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  recordChange(
    entityType: ChangeHistory['entityType'],
    entityId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
    changeReason?: string,
    importBatchId?: string,
    affectedEntityType?: 'approval_record' | 'track_alias',
    affectedEntityId?: string,
    snapshotId?: string
  ): ChangeHistory {
    return this.store.addChangeHistory({
      entityType,
      entityId,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changeReason,
      importBatchId,
      affectedEntityType,
      affectedEntityId,
      snapshotId
    });
  }

  getHistoryForTrackRemark(remarkId: string): ChangeHistory[] {
    return this.store.getChangeHistoryByEntity('track_remark', remarkId);
  }

  getHistoryForApprovalRecord(approvalId: string): ChangeHistory[] {
    return this.store.getChangeHistoryByEntity('approval_record', approvalId);
  }

  getHistoryForTrackAlias(aliasId: string): ChangeHistory[] {
    return this.store.getChangeHistoryByEntity('track_alias', aliasId);
  }

  getHistoryByImportBatch(importBatchId: string): ChangeHistory[] {
    return this.store.getChangeHistoryByBatch(importBatchId);
  }

  getHistoryByAffectedEntity(entityType: 'approval_record' | 'track_alias', entityId: string): ChangeHistory[] {
    return this.store.getChangeHistoryByAffectedEntity(entityType, entityId);
  }

  getDiffForEntity(entityType: ChangeHistory['entityType'], entityId: string): Array<{
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
  }> {
    const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
    return histories.map(h => ({
      fieldName: h.fieldName,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changedAt: h.changedAt,
      changeReason: h.changeReason,
      importBatchId: h.importBatchId,
      affectedEntityType: h.affectedEntityType,
      affectedEntityId: h.affectedEntityId,
      snapshotId: h.snapshotId
    }));
  }

  compareFieldChanges(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string): Array<{
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
    importBatchId?: string;
  }> {
    const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
    return histories
      .filter(h => h.fieldName === fieldName)
      .map(h => ({
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
        importBatchId: h.importBatchId
      }));
  }
}
