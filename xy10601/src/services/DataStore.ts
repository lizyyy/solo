import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderItem,
  Product,
  TimelineEvent,
  TimelineEventType,
  RefundCallback,
  OutOfStockItem,
  PickingRecord,
  ModifiedRecord,
  OrderStatus
} from '../types';

class DataStore {
  private products: Map<string, Product> = new Map();
  private orders: Map<string, Order> = new Map();
  private orderNoIndex: Map<string, string> = new Map();
  private timeline: Map<string, TimelineEvent[]> = new Map();
  private refundCallbacks: Map<string, RefundCallback> = new Map();
  private outOfStockItems: Map<string, OutOfStockItem[]> = new Map();
  private pickingRecords: Map<string, PickingRecord[]> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    this.products.set('p1', {
      id: 'p1',
      name: '新鲜苹果',
      sku: 'SKU-APPLE-001',
      price: 8.5,
      availableStock: 100,
      blockedStock: 0
    });
    this.products.set('p2', {
      id: 'p2',
      name: '进口香蕉',
      sku: 'SKU-BANANA-002',
      price: 5.0,
      availableStock: 50,
      blockedStock: 0
    });
    this.products.set('p3', {
      id: 'p3',
      name: '牛奶套装',
      sku: 'SKU-MILK-003',
      price: 45.0,
      availableStock: 20,
      blockedStock: 0
    });
    this.products.set('p4', {
      id: 'p4',
      name: '鸡蛋礼盒',
      sku: 'SKU-EGG-004',
      price: 28.0,
      availableStock: 30,
      blockedStock: 0
    });
    this.products.set('p5', {
      id: 'p5',
      name: '有机蔬菜包',
      sku: 'SKU-VEG-005',
      price: 35.0,
      availableStock: 15,
      blockedStock: 0
    });
    this.products.set('p6', {
      id: 'p6',
      name: '替换苹果',
      sku: 'SKU-APPLE-REP-006',
      price: 10.0,
      availableStock: 200,
      blockedStock: 0
    });
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  updateProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  createOrder(orderData: Partial<Order>): Order {
    const id = uuidv4();
    const orderNo = 'GB' + Date.now().toString().slice(-10);
    const now = new Date().toISOString();
    const order: Order = {
      id,
      orderNo,
      communityId: orderData.communityId || 'c1',
      communityName: orderData.communityName || '阳光小区',
      groupLeaderId: orderData.groupLeaderId || 'g1',
      groupLeaderName: orderData.groupLeaderName || '张团长',
      userId: orderData.userId || 'u1',
      userName: orderData.userName || '李用户',
      phone: orderData.phone || '13800138000',
      address: orderData.address || '阳光小区1号楼101',
      items: orderData.items || [],
      totalAmount: orderData.totalAmount || 0,
      actualAmount: orderData.actualAmount || orderData.totalAmount || 0,
      refundAmount: 0,
      status: orderData.status || OrderStatus.CREATED,
      createdAt: now,
      updatedAt: now,
      modifiedHistory: []
    };
    this.orders.set(id, order);
    this.orderNoIndex.set(orderNo, id);
    this.timeline.set(id, []);
    this.outOfStockItems.set(id, []);
    this.pickingRecords.set(id, []);
    return order;
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  getOrderByNo(orderNo: string): Order | undefined {
    const id = this.orderNoIndex.get(orderNo);
    return id ? this.orders.get(id) : undefined;
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  updateOrder(order: Order): void {
    order.updatedAt = new Date().toISOString();
    this.orders.set(order.id, order);
  }

  addTimelineEvent(orderId: string, event: Omit<TimelineEvent, 'id' | 'orderId' | 'timestamp'>): TimelineEvent {
    const timelineEvent: TimelineEvent = {
      id: uuidv4(),
      orderId,
      timestamp: new Date().toISOString(),
      ...event
    };
    const events = this.timeline.get(orderId) || [];
    events.push(timelineEvent);
    this.timeline.set(orderId, events);
    return timelineEvent;
  }

  getTimeline(orderId: string): TimelineEvent[] {
    const events = this.timeline.get(orderId) || [];
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getAllTimelineEvents(): TimelineEvent[] {
    const all: TimelineEvent[] = [];
    this.timeline.forEach((events) => all.push(...events));
    return all;
  }

  addModifiedRecord(orderId: string, record: Omit<ModifiedRecord, 'id' | 'orderId' | 'timestamp'>): ModifiedRecord {
    const order = this.getOrder(orderId);
    if (!order) throw new Error('Order not found');
    const modRecord: ModifiedRecord = {
      id: uuidv4(),
      orderId,
      timestamp: new Date().toISOString(),
      ...record
    };
    order.modifiedHistory.push(modRecord);
    this.updateOrder(order);
    return modRecord;
  }

  saveRefundCallback(callback: RefundCallback): RefundCallback {
    this.refundCallbacks.set(callback.callbackId, callback);
    return callback;
  }

  getRefundCallback(callbackId: string): RefundCallback | undefined {
    return this.refundCallbacks.get(callbackId);
  }

  addOutOfStockItem(item: Omit<OutOfStockItem, 'id'>): OutOfStockItem {
    const outOfStockItem: OutOfStockItem = {
      id: uuidv4(),
      ...item
    };
    const items = this.outOfStockItems.get(item.orderId) || [];
    items.push(outOfStockItem);
    this.outOfStockItems.set(item.orderId, items);
    return outOfStockItem;
  }

  getOutOfStockItems(orderId: string): OutOfStockItem[] {
    return this.outOfStockItems.get(orderId) || [];
  }

  updateOutOfStockItem(item: OutOfStockItem): void {
    const items = this.outOfStockItems.get(item.orderId) || [];
    const index = items.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
      this.outOfStockItems.set(item.orderId, items);
    }
  }

  addPickingRecord(record: Omit<PickingRecord, 'id'>): PickingRecord {
    const pickingRecord: PickingRecord = {
      id: uuidv4(),
      ...record
    };
    const records = this.pickingRecords.get(pickingRecord.orderId) || [];
    records.push(pickingRecord);
    this.pickingRecords.set(pickingRecord.orderId, records);
    return pickingRecord;
  }

  getPickingRecords(orderId: string): PickingRecord[] {
    return this.pickingRecords.get(orderId) || [];
  }
}

export const dataStore = new DataStore();
