import {
  Product,
  Warehouse,
  Batch,
  Transfer,
  Freeze,
  Unfreeze,
  InventoryLoss,
  Disposal,
  Alert
} from '../types';

class DataStore {
  private products: Map<string, Product> = new Map();
  private warehouses: Map<string, Warehouse> = new Map();
  private batches: Map<string, Batch> = new Map();
  private transfers: Map<string, Transfer> = new Map();
  private freezes: Map<string, Freeze> = new Map();
  private unfreezes: Map<string, Unfreeze> = new Map();
  private inventoryLosses: Map<string, InventoryLoss> = new Map();
  private disposals: Map<string, Disposal> = new Map();
  private alerts: Map<string, Alert> = new Map();

  private lastAlertRunDate: Date | null = null;

  getLastAlertRunDate(): Date | null {
    return this.lastAlertRunDate;
  }

  setLastAlertRunDate(date: Date): void {
    this.lastAlertRunDate = date;
  }

  getProducts(): Product[] {
    return Array.from(this.products.values());
  }

  getProductById(id: string): Product | undefined {
    return this.products.get(id);
  }

  addProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  getWarehouses(): Warehouse[] {
    return Array.from(this.warehouses.values());
  }

  getWarehouseById(id: string): Warehouse | undefined {
    return this.warehouses.get(id);
  }

  addWarehouse(warehouse: Warehouse): void {
    this.warehouses.set(warehouse.id, warehouse);
  }

  getBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  getBatchById(id: string): Batch | undefined {
    return this.batches.get(id);
  }

  getBatchByNumber(batchNumber: string): Batch | undefined {
    return Array.from(this.batches.values()).find(
      b => b.batchNumber === batchNumber
    );
  }

  addBatch(batch: Batch): void {
    this.batches.set(batch.id, batch);
  }

  updateBatch(batch: Batch): void {
    this.batches.set(batch.id, { ...batch, updatedAt: new Date() });
  }

  getTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  getTransfersByBatchId(batchId: string): Transfer[] {
    return Array.from(this.transfers.values()).filter(
      t => t.batchId === batchId
    );
  }

  addTransfer(transfer: Transfer): void {
    this.transfers.set(transfer.id, transfer);
  }

  getFreezes(): Freeze[] {
    return Array.from(this.freezes.values());
  }

  getActiveFreezesByBatchId(batchId: string): Freeze[] {
    return Array.from(this.freezes.values()).filter(
      f => f.batchId === batchId && f.isActive
    );
  }

  addFreeze(freeze: Freeze): void {
    this.freezes.set(freeze.id, freeze);
  }

  updateFreeze(freeze: Freeze): void {
    this.freezes.set(freeze.id, freeze);
  }

  getFreezeById(id: string): Freeze | undefined {
    return this.freezes.get(id);
  }

  addUnfreeze(unfreeze: Unfreeze): void {
    this.unfreezes.set(unfreeze.id, unfreeze);
  }

  getInventoryLosses(): InventoryLoss[] {
    return Array.from(this.inventoryLosses.values());
  }

  getInventoryLossesByBatchId(batchId: string): InventoryLoss[] {
    return Array.from(this.inventoryLosses.values()).filter(
      il => il.batchId === batchId
    );
  }

  addInventoryLoss(loss: InventoryLoss): void {
    this.inventoryLosses.set(loss.id, loss);
  }

  getDisposals(): Disposal[] {
    return Array.from(this.disposals.values());
  }

  getDisposalsByBatchId(batchId: string): Disposal[] {
    return Array.from(this.disposals.values()).filter(
      d => d.batchId === batchId
    );
  }

  hasDisposalForBatch(batchId: string): boolean {
    return this.getDisposalsByBatchId(batchId).length > 0;
  }

  addDisposal(disposal: Disposal): void {
    this.disposals.set(disposal.id, disposal);
  }

  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getUnresolvedAlertsByBatchId(batchId: string): Alert[] {
    return Array.from(this.alerts.values()).filter(
      a => a.batchId === batchId && !a.isResolved
    );
  }

  addAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);
  }

  resolveAlertsForBatch(batchId: string): void {
    Array.from(this.alerts.values())
      .filter(a => a.batchId === batchId)
      .forEach(a => {
        this.alerts.set(a.id, { ...a, isResolved: true });
      });
  }

  hasAlertForBatchToday(batchId: string, today: Date): boolean {
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.alerts.values()).some(
      a =>
        a.batchId === batchId &&
        a.alertDate >= startOfDay &&
        a.alertDate <= endOfDay
    );
  }

  clearAll(): void {
    this.products.clear();
    this.warehouses.clear();
    this.batches.clear();
    this.transfers.clear();
    this.freezes.clear();
    this.unfreezes.clear();
    this.inventoryLosses.clear();
    this.disposals.clear();
    this.alerts.clear();
    this.lastAlertRunDate = null;
  }
}

export const dataStore = new DataStore();
