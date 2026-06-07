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
    changeReason?: string
  ): ChangeHistory {
    return this.store.addChangeHistory({
      entityType,
      entityId,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changeReason
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

  getDiffForEntity(entityType: ChangeHistory['entityType'], entityId: string): Array<{
    fieldName: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
    changeReason?: string;
  }> {
    const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
    return histories.map(h => ({
      fieldName: h.fieldName,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changedAt: h.changedAt,
      changeReason: h.changeReason
    }));
  }

  compareFieldChanges(entityType: ChangeHistory['entityType'], entityId: string, fieldName: string): Array<{
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
  }> {
    const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
    return histories
      .filter(h => h.fieldName === fieldName)
      .map(h => ({
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changedAt: h.changedAt
      }));
  }
}
