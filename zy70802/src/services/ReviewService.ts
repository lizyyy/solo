import { DataStore } from '../store/DataStore';
import { ReconciliationEngine } from './ReconciliationEngine';

export class ReviewService {
  private dataStore: DataStore;
  private engine: ReconciliationEngine;

  constructor() {
    this.dataStore = DataStore.getInstance();
    this.engine = new ReconciliationEngine();
  }

  async reviewAndConfirm(
    reconciliationId: string,
    reviewer: string,
    notes?: string
  ) {
    const reconciliation = this.dataStore.getReconciliation(reconciliationId);
    if (!reconciliation) {
      throw new Error(`对账记录不存在: ${reconciliationId}`);
    }

    this.dataStore.addReviewAction({
      reconciliationId,
      actionType: 'confirm',
      performedBy: reviewer,
      performedAt: new Date(),
      notes,
    });

    return this.dataStore.updateReconciliation(reconciliationId, {
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: reviewer,
      reviewNotes: notes,
    });
  }

  async modifyCallback(
    reconciliationId: string,
    callbackUpdates: {
      doctorName?: string;
      calledTo?: string;
      confirmedAt?: Date;
      confirmationNotes?: string;
      callResult?: 'connected' | 'no_answer' | 'busy' | 'wrong_number';
    },
    reviewer: string,
    notes?: string
  ) {
    const reconciliation = this.dataStore.getReconciliation(reconciliationId);
    if (!reconciliation) {
      throw new Error(`对账记录不存在: ${reconciliationId}`);
    }

    if (!reconciliation.callbackId) {
      throw new Error('该对账记录没有关联的电话回告记录');
    }

    const callback = this.dataStore.getCallback(reconciliation.callbackId);
    if (!callback) {
      throw new Error(`电话回告记录不存在: ${reconciliation.callbackId}`);
    }

    const oldValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(callbackUpdates)) {
      const oldVal = (callback as any)[key];
      if (oldVal !== undefined) {
        oldValues[key] = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal);
      }
    }

    const updatedCallback = this.dataStore.updateCallback(reconciliation.callbackId, callbackUpdates);

    this.dataStore.addReviewAction({
      reconciliationId,
      actionType: 'modify',
      fieldName: Object.keys(callbackUpdates).join(','),
      oldValue: JSON.stringify(oldValues),
      newValue: JSON.stringify(callbackUpdates),
      performedBy: reviewer,
      performedAt: new Date(),
      notes,
    });

    await this.engine.runReconciliation();

    return this.dataStore.getReconciliation(reconciliationId);
  }

  async dismissDiscrepancy(
    reconciliationId: string,
    discrepancyType: string,
    reviewer: string,
    reason: string
  ) {
    const reconciliation = this.dataStore.getReconciliation(reconciliationId);
    if (!reconciliation) {
      throw new Error(`对账记录不存在: ${reconciliationId}`);
    }

    const remainingDiscrepancies = reconciliation.discrepancies.filter(
      d => d.type !== discrepancyType
    );

    const updated = this.dataStore.updateReconciliation(reconciliationId, {
      discrepancies: remainingDiscrepancies,
      status: remainingDiscrepancies.length === 0 ? 'reviewed' : reconciliation.status,
    });

    this.dataStore.addReviewAction({
      reconciliationId,
      actionType: 'dismiss',
      fieldName: discrepancyType,
      oldValue: '存在',
      newValue: '已忽略',
      performedBy: reviewer,
      performedAt: new Date(),
      notes: reason,
    });

    return updated;
  }

  async rerunReconciliation() {
    return this.engine.runReconciliation();
  }

  getReviewHistory(reconciliationId: string) {
    return this.dataStore.getReviewActions(reconciliationId);
  }

  getAllReviewHistory() {
    return this.dataStore.getAllReviewActions();
  }
}
