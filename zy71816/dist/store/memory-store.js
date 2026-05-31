export class InMemoryStore {
    receipts = new Map();
    judgments = new Map();
    history = new Map();
    crossPeriodAlerts = new Map();
    refundItems = new Map();
    refundChanges = new Map();
    reconciliations = new Map();
    batches = new Map();
    getReceipt(id) {
        return this.receipts.get(id);
    }
    findReceiptByOrder(platform, orderId) {
        for (const r of this.receipts.values()) {
            if (r.platform === platform && r.orderId === orderId)
                return r;
        }
        return undefined;
    }
    saveReceipt(receipt) {
        this.receipts.set(receipt.id, receipt);
    }
    listReceipts() {
        return [...this.receipts.values()];
    }
    saveJudgment(result) {
        const list = this.judgments.get(result.receiptId) ?? [];
        list.push(result);
        this.judgments.set(result.receiptId, list);
    }
    getJudgmentsByReceipt(receiptId) {
        return this.judgments.get(receiptId) ?? [];
    }
    getJudgmentByBatch(receiptId, batchRunId) {
        return (this.judgments.get(receiptId) ?? []).find(j => j.batchRunId === batchRunId);
    }
    saveHistoryEntry(entry) {
        const list = this.history.get(entry.receiptId) ?? [];
        list.push(entry);
        this.history.set(entry.receiptId, list);
    }
    getHistory(receiptId) {
        return this.history.get(receiptId) ?? [];
    }
    saveCrossPeriodAlert(alert) {
        const list = this.crossPeriodAlerts.get(alert.receiptId) ?? [];
        list.push(alert);
        this.crossPeriodAlerts.set(alert.receiptId, list);
    }
    getCrossPeriodAlerts(receiptId) {
        return this.crossPeriodAlerts.get(receiptId) ?? [];
    }
    saveRefundItem(item) {
        this.refundItems.set(item.id, item);
    }
    getRefundItem(id) {
        return this.refundItems.get(id);
    }
    getRefundsByReceipt(receiptId) {
        return [...this.refundItems.values()].filter(r => r.receiptId === receiptId);
    }
    saveRefundChange(record) {
        const list = this.refundChanges.get(record.refundItemId) ?? [];
        list.push(record);
        this.refundChanges.set(record.refundItemId, list);
    }
    getRefundChanges(refundItemId) {
        return this.refundChanges.get(refundItemId) ?? [];
    }
    saveReconciliation(stmt) {
        this.reconciliations.set(`${stmt.receiptId}::${stmt.period}`, stmt);
    }
    getReconciliation(receiptId, period) {
        return this.reconciliations.get(`${receiptId}::${period}`);
    }
    saveBatch(batch) {
        this.batches.set(batch.id, batch);
    }
    getBatch(id) {
        return this.batches.get(id);
    }
}
//# sourceMappingURL=memory-store.js.map