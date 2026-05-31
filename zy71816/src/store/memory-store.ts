import type {
  ReceiptLine,
  JudgmentResult,
  RefundItem,
  RefundChangeRecord,
  CrossPeriodFeeAlert,
  ReceiptHistoryEntry,
  ReconciliationStatement,
  ProcessingBatch,
} from '../domain/types.js';

export interface OverseasReceiptStore {
  getReceipt(id: string): ReceiptLine | undefined;
  findReceiptByOrder(platform: string, orderId: string): ReceiptLine | undefined;
  saveReceipt(receipt: ReceiptLine): void;
  listReceipts(): ReceiptLine[];

  saveJudgment(result: JudgmentResult): void;
  getJudgmentsByReceipt(receiptId: string): JudgmentResult[];
  getJudgmentByBatch(receiptId: string, batchRunId: string): JudgmentResult | undefined;

  saveHistoryEntry(entry: ReceiptHistoryEntry): void;
  getHistory(receiptId: string): ReceiptHistoryEntry[];

  saveCrossPeriodAlert(alert: CrossPeriodFeeAlert): void;
  getCrossPeriodAlerts(receiptId: string): CrossPeriodFeeAlert[];

  saveRefundItem(item: RefundItem): void;
  getRefundItem(id: string): RefundItem | undefined;
  getRefundsByReceipt(receiptId: string): RefundItem[];

  saveRefundChange(record: RefundChangeRecord): void;
  getRefundChanges(refundItemId: string): RefundChangeRecord[];

  saveReconciliation(stmt: ReconciliationStatement): void;
  getReconciliation(receiptId: string, period: string): ReconciliationStatement | undefined;

  saveBatch(batch: ProcessingBatch): void;
  getBatch(id: string): ProcessingBatch | undefined;
}

export class InMemoryStore implements OverseasReceiptStore {
  private receipts = new Map<string, ReceiptLine>();
  private judgments = new Map<string, JudgmentResult[]>();
  private history = new Map<string, ReceiptHistoryEntry[]>();
  private crossPeriodAlerts = new Map<string, CrossPeriodFeeAlert[]>();
  private refundItems = new Map<string, RefundItem>();
  private refundChanges = new Map<string, RefundChangeRecord[]>();
  private reconciliations = new Map<string, ReconciliationStatement>();
  private batches = new Map<string, ProcessingBatch>();

  getReceipt(id: string): ReceiptLine | undefined {
    return this.receipts.get(id);
  }

  findReceiptByOrder(platform: string, orderId: string): ReceiptLine | undefined {
    for (const r of this.receipts.values()) {
      if (r.platform === platform && r.orderId === orderId) return r;
    }
    return undefined;
  }

  saveReceipt(receipt: ReceiptLine): void {
    this.receipts.set(receipt.id, receipt);
  }

  listReceipts(): ReceiptLine[] {
    return [...this.receipts.values()];
  }

  saveJudgment(result: JudgmentResult): void {
    const list = this.judgments.get(result.receiptId) ?? [];
    list.push(result);
    this.judgments.set(result.receiptId, list);
  }

  getJudgmentsByReceipt(receiptId: string): JudgmentResult[] {
    return this.judgments.get(receiptId) ?? [];
  }

  getJudgmentByBatch(receiptId: string, batchRunId: string): JudgmentResult | undefined {
    return (this.judgments.get(receiptId) ?? []).find(j => j.batchRunId === batchRunId);
  }

  saveHistoryEntry(entry: ReceiptHistoryEntry): void {
    const list = this.history.get(entry.receiptId) ?? [];
    list.push(entry);
    this.history.set(entry.receiptId, list);
  }

  getHistory(receiptId: string): ReceiptHistoryEntry[] {
    return this.history.get(receiptId) ?? [];
  }

  saveCrossPeriodAlert(alert: CrossPeriodFeeAlert): void {
    const list = this.crossPeriodAlerts.get(alert.receiptId) ?? [];
    list.push(alert);
    this.crossPeriodAlerts.set(alert.receiptId, list);
  }

  getCrossPeriodAlerts(receiptId: string): CrossPeriodFeeAlert[] {
    return this.crossPeriodAlerts.get(receiptId) ?? [];
  }

  saveRefundItem(item: RefundItem): void {
    this.refundItems.set(item.id, item);
  }

  getRefundItem(id: string): RefundItem | undefined {
    return this.refundItems.get(id);
  }

  getRefundsByReceipt(receiptId: string): RefundItem[] {
    return [...this.refundItems.values()].filter(r => r.receiptId === receiptId);
  }

  saveRefundChange(record: RefundChangeRecord): void {
    const list = this.refundChanges.get(record.refundItemId) ?? [];
    list.push(record);
    this.refundChanges.set(record.refundItemId, list);
  }

  getRefundChanges(refundItemId: string): RefundChangeRecord[] {
    return this.refundChanges.get(refundItemId) ?? [];
  }

  saveReconciliation(stmt: ReconciliationStatement): void {
    this.reconciliations.set(`${stmt.receiptId}::${stmt.period}`, stmt);
  }

  getReconciliation(receiptId: string, period: string): ReconciliationStatement | undefined {
    return this.reconciliations.get(`${receiptId}::${period}`);
  }

  saveBatch(batch: ProcessingBatch): void {
    this.batches.set(batch.id, batch);
  }

  getBatch(id: string): ProcessingBatch | undefined {
    return this.batches.get(id);
  }
}
