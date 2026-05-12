import { v4 as uuidv4 } from 'uuid';
import { Database } from '../store/database';
import { WeightRecord, WeightRecordStatus, OrderStatus } from '../types';
import { OrderService } from './order.service';

export class WeightService {
  private db = Database.getInstance();
  private orderService = new OrderService();

  submitWeight(data: {
    requestId: string;
    orderId: string;
    orderItemId: string;
    actualWeight: number;
    operatorId: string;
    operatorName: string;
    deviceId: string;
    batchNo?: string;
  }): WeightRecord {
    if (!data.requestId || data.requestId.trim() === '') {
      throw new Error('requestId is required for idempotency');
    }

    const cachedResult = this.db.getIdempotentResult(data.requestId);
    if (cachedResult) {
      return cachedResult;
    }

    if (data.actualWeight <= 0) {
      throw new Error('Actual weight must be greater than zero');
    }

    const order = this.db.getOrder(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.OUTBOUND) {
      throw new Error('Cannot submit weight after order is outbound');
    }

    const orderItem = order.items.find(item => item.id === data.orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found');
    }

    const existingRecords = this.db.getWeightRecordsByOrderItem(data.orderItemId);
    const confirmedRecords = existingRecords.filter(r => r.status === WeightRecordStatus.CONFIRMED);
    
    let previousRecordId: string | null = null;
    if (confirmedRecords.length > 0) {
      const latestRecord = confirmedRecords[0];
      latestRecord.status = WeightRecordStatus.SUPERSEDED;
      this.db.saveWeightRecord(latestRecord);
      previousRecordId = latestRecord.id;
    }

    const weightRecord: WeightRecord = {
      id: uuidv4(),
      orderId: data.orderId,
      orderItemId: data.orderItemId,
      batchNo: data.batchNo || `BATCH-${Date.now()}`,
      actualWeight: Number(data.actualWeight.toFixed(3)),
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      weighTime: new Date(),
      status: WeightRecordStatus.CONFIRMED,
      previousRecordId,
      deviceId: data.deviceId,
      requestId: data.requestId
    };

    this.db.saveWeightRecord(weightRecord);
    this.orderService.updateOrderItemWeight(
      data.orderId,
      data.orderItemId,
      data.actualWeight,
      weightRecord.id
    );

    this.db.setIdempotentResult(data.requestId, weightRecord);
    return weightRecord;
  }

  replaceItemWithWeight(data: {
    requestId: string;
    orderId: string;
    orderItemId: string;
    newProductId: string;
    actualWeight: number;
    operatorId: string;
    operatorName: string;
    deviceId: string;
    batchNo?: string;
  }): WeightRecord {
    if (!data.requestId || data.requestId.trim() === '') {
      throw new Error('requestId is required for idempotency');
    }

    const cachedResult = this.db.getIdempotentResult(data.requestId);
    if (cachedResult) {
      return cachedResult;
    }

    if (data.actualWeight <= 0) {
      throw new Error('Actual weight must be greater than zero');
    }

    const order = this.db.getOrder(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.OUTBOUND) {
      throw new Error('Cannot replace item after order is outbound');
    }

    const orderItem = order.items.find(item => item.id === data.orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found');
    }

    const newProduct = this.db.getProduct(data.newProductId);
    if (!newProduct) {
      throw new Error('New product not found');
    }

    const priceDifference = newProduct.unitPrice - orderItem.unitPrice;
    if (priceDifference > 0) {
      throw new Error(`Replacement product price is higher by ${priceDifference.toFixed(2)} yuan, need approval`);
    }

    const weightRecord: WeightRecord = {
      id: uuidv4(),
      orderId: data.orderId,
      orderItemId: data.orderItemId,
      batchNo: data.batchNo || `BATCH-${Date.now()}`,
      actualWeight: Number(data.actualWeight.toFixed(3)),
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      weighTime: new Date(),
      status: WeightRecordStatus.CONFIRMED,
      previousRecordId: null,
      deviceId: data.deviceId,
      requestId: data.requestId
    };

    this.db.saveWeightRecord(weightRecord);
    this.orderService.replaceOrderItem(
      data.orderId,
      data.orderItemId,
      data.newProductId,
      data.actualWeight,
      weightRecord.id
    );

    this.db.setIdempotentResult(data.requestId, weightRecord);
    return weightRecord;
  }

  getWeightRecord(id: string): WeightRecord | undefined {
    return this.db.getWeightRecord(id);
  }

  getWeightRecordsByOrder(orderId: string): WeightRecord[] {
    return this.db.getWeightRecordsByOrder(orderId);
  }

  getWeightRecordsByOrderItem(orderItemId: string): WeightRecord[] {
    return this.db.getWeightRecordsByOrderItem(orderItemId);
  }

  getWeightHistory(orderItemId: string): Array<WeightRecord & { isLatest: boolean }> {
    const records = this.getWeightRecordsByOrderItem(orderItemId);
    return records.map((r, index) => ({
      ...r,
      isLatest: index === 0 && r.status === WeightRecordStatus.CONFIRMED
    }));
  }
}
