import { WorkRecord, BillingResult } from '../types';
import { dataStore } from '../store';
import { billingEngine } from './billingEngine';

export class BillingService {
  calculateAndUpdateRecord(recordId: string, operator: string): BillingResult | null {
    const record = dataStore.getRecordById(recordId);
    if (!record) return null;

    const result = billingEngine.calculateBilling(record);

    dataStore.updateRecord(
      recordId,
      {
        calculatedAmount: result.calculatedAmount,
        finalAmount: result.finalAmount,
        exceptions: result.exceptions,
        status: result.status,
      },
      operator
    );

    dataStore.addAuditLog('calculate_billing', operator, {
      recordId,
      recordNo: record.recordNo,
      result,
    });

    return result;
  }

  calculateAllPending(operator: string): BillingResult[] {
    const pendingRecords = dataStore
      .getAllRecords()
      .filter(r => r.status === 'pending' && !r.isBilled);

    const results: BillingResult[] = [];

    for (const record of pendingRecords) {
      const result = this.calculateAndUpdateRecord(record.id, operator);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  billRecords(recordIds: string[], operator: string): { success: string[]; failed: string[] } {
    const success: string[] = [];
    const failed: string[] = [];

    for (const recordId of recordIds) {
      const record = dataStore.getRecordById(recordId);
      if (!record) {
        failed.push(recordId);
        continue;
      }

      if (record.isBilled) {
        failed.push(recordId);
        continue;
      }

      if (record.status !== 'valid') {
        failed.push(recordId);
        continue;
      }

      dataStore.updateRecord(
        recordId,
        {
          isBilled: true,
          billedAt: new Date(),
          billedBy: operator,
          status: 'billed',
        },
        operator
      );

      success.push(recordId);

      dataStore.addAuditLog('bill_record', operator, {
        recordId,
        recordNo: record.recordNo,
        finalAmount: record.finalAmount,
      });
    }

    return { success, failed };
  }

  billAllValid(operator: string): { success: string[]; failed: string[] } {
    const validRecords = dataStore
      .getAllRecords()
      .filter(r => r.status === 'valid' && !r.isBilled)
      .map(r => r.id);

    return this.billRecords(validRecords, operator);
  }

  reviewRecord(
    recordId: string,
    operator: string,
    notes: string,
    approve: boolean
  ): WorkRecord | null {
    const record = dataStore.getRecordById(recordId);
    if (!record) return null;

    const updates: Partial<WorkRecord> = {
      reviewNotes: notes,
      reviewedBy: operator,
      reviewedAt: new Date(),
    };

    if (approve) {
      updates.status = 'reviewed';
    } else {
      updates.status = 'invalid';
    }

    const updated = dataStore.updateRecord(recordId, updates, operator);

    dataStore.addAuditLog('review_record', operator, {
      recordId,
      recordNo: record.recordNo,
      approve,
      notes,
    });

    return updated;
  }

  getBillSummary(filter: { startDate?: Date; endDate?: Date; operator?: string } = {}) {
    let records = dataStore.getAllRecords();

    if (filter.startDate) {
      records = records.filter(r => r.billedAt && r.billedAt >= filter.startDate!);
    }

    if (filter.endDate) {
      records = records.filter(r => r.billedAt && r.billedAt <= filter.endDate!);
    }

    if (filter.operator) {
      records = records.filter(r => r.billedBy === filter.operator);
    }

    const billedRecords = records.filter(r => r.isBilled);

    return {
      totalBilled: billedRecords.length,
      totalAmount: billedRecords.reduce((sum, r) => sum + r.finalAmount, 0),
      byOperator: billedRecords.reduce((acc, r) => {
        acc[r.operator] = (acc[r.operator] || 0) + r.finalAmount;
        return acc;
      }, {} as Record<string, number>),
      byTractor: billedRecords.reduce((acc, r) => {
        acc[r.tractorNo] = (acc[r.tractorNo] || 0) + r.finalAmount;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  getAuditLogs(filter?: { recordId?: string; action?: string; operator?: string }) {
    return dataStore.getAuditLogs(filter);
  }
}

export const billingService = new BillingService();
