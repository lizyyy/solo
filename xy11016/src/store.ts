import { Order, Oven, CapacityRecord, OrderChangeHistory } from './types';

export class DataStore {
  private orders: Map<string, Order> = new Map();
  private ovens: Map<string, Oven> = new Map();
  private capacityRecords: Map<string, CapacityRecord> = new Map();
  private changeHistories: OrderChangeHistory[] = [];

  getOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  addOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  updateOrder(id: string, order: Order): void {
    this.orders.set(id, order);
  }

  deleteOrder(id: string): boolean {
    return this.orders.delete(id);
  }

  getOvens(): Oven[] {
    return Array.from(this.ovens.values());
  }

  getOvenById(id: string): Oven | undefined {
    return this.ovens.get(id);
  }

  addOven(oven: Oven): void {
    this.ovens.set(oven.id, oven);
  }

  getCapacityRecords(): CapacityRecord[] {
    return Array.from(this.capacityRecords.values());
  }

  getCapacityRecord(ovenId: string, date: string, timeSlot: string): CapacityRecord | undefined {
    return Array.from(this.capacityRecords.values()).find(
      r => r.ovenId === ovenId && r.date === date && r.timeSlot === timeSlot
    );
  }

  addCapacityRecord(record: CapacityRecord): void {
    this.capacityRecords.set(record.id, record);
  }

  updateCapacityRecord(id: string, record: CapacityRecord): void {
    this.capacityRecords.set(id, record);
  }

  getCapacityByOvenAndDate(ovenId: string, date: string): CapacityRecord[] {
    return Array.from(this.capacityRecords.values()).filter(
      r => r.ovenId === ovenId && r.date === date
    );
  }

  addChangeHistory(history: OrderChangeHistory): void {
    this.changeHistories.push(history);
  }

  getChangeHistoriesByOrderId(orderId: string): OrderChangeHistory[] {
    return this.changeHistories
      .filter(h => h.orderId === orderId)
      .sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());
  }

  clearAll(): void {
    this.orders.clear();
    this.ovens.clear();
    this.capacityRecords.clear();
    this.changeHistories = [];
  }

  getOrdersBySchedule(ovenId: string, date: string, timeSlot: string): Order[] {
    return Array.from(this.orders.values()).filter(
      o => o.scheduledOvenId === ovenId &&
           o.scheduledDate === date &&
           o.scheduledTimeSlot === timeSlot &&
           o.status !== '已取消' &&
           o.status !== '已撤回'
    );
  }
}

export const store = new DataStore();