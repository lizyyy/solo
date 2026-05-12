import { v4 as uuidv4 } from 'uuid';
import { Database } from '../store/database';
import { RefundRecord, RefundStatus, RefundReason, OrderStatus } from '../types';

export class RefundService {
  private db = Database.getInstance();

  createRefund(data: {
    orderId: string;
    orderItemId?: string;
    reason: RefundReason;
    reasonDetail: string;
    amount: number;
    operatorId: string;
    operatorName: string;
  }): RefundRecord {
    const order = this.db.getOrder(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (data.amount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }

    if (data.orderItemId) {
      const orderItem = order.items.find(item => item.id === data.orderItemId);
      if (!orderItem) {
        throw new Error('Order item not found');
      }
      if (orderItem.actualAmount && data.amount > orderItem.actualAmount) {
        throw new Error('Refund amount cannot exceed item actual amount');
      }
    } else {
      if (order.totalActualAmount && data.amount > order.totalActualAmount) {
        throw new Error('Refund amount cannot exceed order total actual amount');
      }
    }

    const refundRecord: RefundRecord = {
      id: uuidv4(),
      orderId: data.orderId,
      orderItemId: data.orderItemId || null,
      reason: data.reason,
      reasonDetail: data.reasonDetail,
      amount: Number(data.amount.toFixed(2)),
      status: RefundStatus.PENDING,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      createdAt: new Date(),
      processedAt: null
    };

    this.db.saveRefundRecord(refundRecord);

    order.hasRefund = true;
    order.updatedAt = new Date();
    this.db.saveOrder(order);

    return refundRecord;
  }

  createWeightDifferenceRefund(data: {
    orderId: string;
    orderItemId: string;
    operatorId: string;
    operatorName: string;
  }): RefundRecord {
    const order = this.db.getOrder(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const orderItem = order.items.find(item => item.id === data.orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found');
    }

    if (orderItem.actualWeight === null || orderItem.actualWeight === undefined) {
      throw new Error('Order item has not been weighed yet');
    }

    const weightDifference = orderItem.actualWeight - orderItem.expectedWeight;
    
    if (weightDifference >= 0) {
      throw new Error('No weight difference refund needed - actual weight is not less than expected');
    }

    const refundAmount = Math.abs(weightDifference) * orderItem.unitPrice;
    
    if (refundAmount <= 0) {
      throw new Error('Calculated refund amount is zero');
    }

    return this.createRefund({
      orderId: data.orderId,
      orderItemId: data.orderItemId,
      reason: RefundReason.WEIGHT_DIFFERENCE,
      reasonDetail: `预估重量: ${orderItem.expectedWeight}kg, 实际重量: ${orderItem.actualWeight}kg, 差异: ${weightDifference.toFixed(3)}kg`,
      amount: refundAmount,
      operatorId: data.operatorId,
      operatorName: data.operatorName
    });
  }

  approveRefund(refundId: string): RefundRecord {
    const refund = this.db.getRefundRecord(refundId);
    if (!refund) {
      throw new Error('Refund record not found');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new Error('Refund is not in pending status');
    }

    refund.status = RefundStatus.APPROVED;
    this.db.saveRefundRecord(refund);
    return refund;
  }

  rejectRefund(refundId: string, reason: string): RefundRecord {
    const refund = this.db.getRefundRecord(refundId);
    if (!refund) {
      throw new Error('Refund record not found');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new Error('Refund is not in pending status');
    }

    refund.status = RefundStatus.REJECTED;
    refund.reasonDetail = `${refund.reasonDetail} (拒绝原因: ${reason})`;
    this.db.saveRefundRecord(refund);
    return refund;
  }

  processRefund(refundId: string): RefundRecord {
    const refund = this.db.getRefundRecord(refundId);
    if (!refund) {
      throw new Error('Refund record not found');
    }

    if (refund.status !== RefundStatus.APPROVED) {
      throw new Error('Refund must be approved before processing');
    }

    refund.status = RefundStatus.PROCESSED;
    refund.processedAt = new Date();
    this.db.saveRefundRecord(refund);

    const order = this.db.getOrder(refund.orderId);
    if (order) {
      const allRefunds = this.db.getRefundRecordsByOrder(refund.orderId);
      const processedRefunds = allRefunds.filter(r => r.status === RefundStatus.PROCESSED);
      const totalRefundAmount = processedRefunds.reduce((sum, r) => sum + r.amount, 0);
      order.totalRefundAmount = Number(totalRefundAmount.toFixed(2));
      order.updatedAt = new Date();
      this.db.saveOrder(order);
    }

    return refund;
  }

  getRefundRecord(id: string): RefundRecord | undefined {
    return this.db.getRefundRecord(id);
  }

  getRefundRecordsByOrder(orderId: string): RefundRecord[] {
    return this.db.getRefundRecordsByOrder(orderId);
  }
}
