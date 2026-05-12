import { Order, WeightRecord, RefundRecord, Product } from '../types';

export class Database {
  private orders: Map<string, Order> = new Map();
  private weightRecords: Map<string, WeightRecord> = new Map();
  private refundRecords: Map<string, RefundRecord> = new Map();
  private products: Map<string, Product> = new Map();
  private requestIdempotency: Map<string, { result: any; timestamp: number }> = new Map();

  private static instance: Database;

  private constructor() {
    this.initProducts();
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private initProducts() {
    const sampleProducts: Product[] = [
      {
        id: 'prod-001',
        name: '有机小白菜',
        sku: 'VEG-001',
        category: '蔬菜',
        unitPrice: 8.99,
        unit: 'kg',
        isFresh: true,
        tolerancePercentage: 5
      },
      {
        id: 'prod-002',
        name: '精选西红柿',
        sku: 'VEG-002',
        category: '蔬菜',
        unitPrice: 12.99,
        unit: 'kg',
        isFresh: true,
        tolerancePercentage: 5
      },
      {
        id: 'prod-003',
        name: '新鲜三文鱼',
        sku: 'SEA-001',
        category: '海鲜',
        unitPrice: 89.99,
        unit: 'kg',
        isFresh: true,
        tolerancePercentage: 3
      },
      {
        id: 'prod-004',
        name: '优选五花肉',
        sku: 'MEA-001',
        category: '肉类',
        unitPrice: 35.99,
        unit: 'kg',
        isFresh: true,
        tolerancePercentage: 3
      },
      {
        id: 'prod-005',
        name: '有机油麦菜',
        sku: 'VEG-003',
        category: '蔬菜',
        unitPrice: 6.99,
        unit: 'kg',
        isFresh: true,
        tolerancePercentage: 5
      }
    ];

    sampleProducts.forEach(p => this.products.set(p.id, p));
  }

  getIdempotentResult(requestId: string, ttlMs: number = 3600000): any | null {
    const cached = this.requestIdempotency.get(requestId);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < ttlMs) {
        return cached.result;
      }
      this.requestIdempotency.delete(requestId);
    }
    return null;
  }

  setIdempotentResult(requestId: string, result: any): void {
    this.requestIdempotency.set(requestId, {
      result,
      timestamp: Date.now()
    });
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  getOrderByNo(orderNo: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.orderNo === orderNo) {
        return order;
      }
    }
    return undefined;
  }

  saveOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  saveWeightRecord(record: WeightRecord): void {
    this.weightRecords.set(record.id, record);
  }

  getWeightRecord(id: string): WeightRecord | undefined {
    return this.weightRecords.get(id);
  }

  getWeightRecordsByOrder(orderId: string): WeightRecord[] {
    return Array.from(this.weightRecords.values())
      .filter(r => r.orderId === orderId)
      .sort((a, b) => b.weighTime.getTime() - a.weighTime.getTime());
  }

  getWeightRecordsByOrderItem(orderItemId: string): WeightRecord[] {
    return Array.from(this.weightRecords.values())
      .filter(r => r.orderItemId === orderItemId)
      .sort((a, b) => b.weighTime.getTime() - a.weighTime.getTime());
  }

  hasWeightRecordByRequestId(requestId: string): boolean {
    return Array.from(this.weightRecords.values())
      .some(r => r.requestId === requestId);
  }

  getWeightRecordByRequestId(requestId: string): WeightRecord | undefined {
    return Array.from(this.weightRecords.values())
      .find(r => r.requestId === requestId);
  }

  saveRefundRecord(record: RefundRecord): void {
    this.refundRecords.set(record.id, record);
  }

  getRefundRecord(id: string): RefundRecord | undefined {
    return this.refundRecords.get(id);
  }

  getRefundRecordsByOrder(orderId: string): RefundRecord[] {
    return Array.from(this.refundRecords.values())
      .filter(r => r.orderId === orderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
