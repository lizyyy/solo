import type {
  RefundItem,
  RefundChangeRecord,
  ReconciliationStatement,
} from '../domain/types.js';
import type { OverseasReceiptStore } from '../store/memory-store.js';

export class RefundAuditService {
  constructor(private store: OverseasReceiptStore) {}

  modifyRefundItem(
    itemId: string,
    changedBy: string,
    field: string,
    newValue: unknown,
    reason: string,
  ): RefundChangeRecord {
    const item = this.store.getRefundItem(itemId);
    if (!item) {
      throw new Error(`退款项 ${itemId} 不存在`);
    }

    const oldValue = (item as unknown as Record<string, unknown>)[field];

    const changeRecord: RefundChangeRecord = {
      id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      refundItemId: itemId,
      changedBy,
      changedAt: new Date().toISOString(),
      field,
      oldValue,
      newValue,
      reason,
    };

    (item as unknown as Record<string, unknown>)[field] = newValue;
    this.store.saveRefundItem(item);
    this.store.saveRefundChange(changeRecord);

    this.syncReconciliationNote(item.receiptId, changeRecord);

    return changeRecord;
  }

  private syncReconciliationNote(receiptId: string, change: RefundChangeRecord): void {
    const existingRefunds = this.store.getRefundsByReceipt(receiptId);
    const totalRefunds = existingRefunds.reduce((sum, r) => sum + (r.status === 'approved' ? r.refundAmount : 0), 0);

    const changes = existingRefunds.flatMap(r => this.store.getRefundChanges(r.id));
    const changeNotes = changes
      .map(c => `[${c.changedAt}] ${c.changedBy} 将 ${c.field} 从 ${JSON.stringify(c.oldValue)} 改为 ${JSON.stringify(c.newValue)}，原因：${c.reason}`)
      .join('\n');

    const receipt = this.store.getReceipt(receiptId);
    const period = receipt ? receipt.receivedAt.slice(0, 7) : 'unknown';

    const stmt: ReconciliationStatement = {
      receiptId,
      period,
      totalReceived: receipt?.amount ?? 0,
      totalFees: receipt?.feeAmount ?? 0,
      totalRefunds,
      netAmount: (receipt?.netAmount ?? 0) - totalRefunds,
      changeRecords: changes,
      notes: changeNotes || '无手动变更记录',
    };

    this.store.saveReconciliation(stmt);
  }

  getRefundChangeHistory(refundItemId: string): RefundChangeRecord[] {
    return this.store.getRefundChanges(refundItemId);
  }

  getReconciliationForReceipt(receiptId: string): ReconciliationStatement | undefined {
    const receipt = this.store.getReceipt(receiptId);
    if (!receipt) return undefined;
    const period = receipt.receivedAt.slice(0, 7);
    return this.store.getReconciliation(receiptId, period);
  }
}
