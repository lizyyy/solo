import { WorkOrder, DirtyRecord, StatusHistory } from './types';

class DataStore {
  private workOrders: Map<string, WorkOrder> = new Map();
  private dirtyRecords: Map<string, DirtyRecord> = new Map();
  private orderCounter: number = 1;

  generateOrderNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(this.orderCounter++).padStart(6, '0');
    return `CP${dateStr}${seq}`;
  }

  saveWorkOrder(order: WorkOrder): void {
    this.workOrders.set(order.id, order);
  }

  getWorkOrder(id: string): WorkOrder | undefined {
    return this.workOrders.get(id);
  }

  getWorkOrderByOrderNo(orderNo: string): WorkOrder | undefined {
    for (const order of this.workOrders.values()) {
      if (order.orderNo === orderNo) {
        return order;
      }
    }
    return undefined;
  }

  getAllWorkOrders(): WorkOrder[] {
    return Array.from(this.workOrders.values());
  }

  deleteWorkOrder(id: string): boolean {
    return this.workOrders.delete(id);
  }

  saveDirtyRecord(record: DirtyRecord): void {
    this.dirtyRecords.set(record.id, record);
  }

  getDirtyRecord(id: string): DirtyRecord | undefined {
    return this.dirtyRecords.get(id);
  }

  getDirtyRecordsByWorkOrderId(workOrderId: string): DirtyRecord[] {
    return Array.from(this.dirtyRecords.values())
      .filter(r => r.workOrderId === workOrderId);
  }

  getAllDirtyRecords(): DirtyRecord[] {
    return Array.from(this.dirtyRecords.values());
  }

  clearAll(): void {
    this.workOrders.clear();
    this.dirtyRecords.clear();
    this.orderCounter = 1;
  }
}

export const store = new DataStore();
