import { v4 as uuidv4 } from 'uuid';
import { Database } from '../store/database';
import { Order, OrderItem, OrderStatus, WeightDifferenceSummary } from '../types';

export class OrderService {
  private db = Database.getInstance();

  createOrder(data: {
    orderNo: string;
    customerId: string;
    customerName: string;
    items: Array<{
      productId: string;
      expectedWeight: number;
    }>;
  }): Order {
    const existingOrder = this.db.getOrderByNo(data.orderNo);
    if (existingOrder) {
      return existingOrder;
    }

    const orderItems: OrderItem[] = data.items.map(item => {
      const product = this.db.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      return {
        id: uuidv4(),
        productId: item.productId,
        productName: product.name,
        expectedWeight: item.expectedWeight,
        actualWeight: null,
        unitPrice: product.unitPrice,
        expectedAmount: Number((item.expectedWeight * product.unitPrice).toFixed(2)),
        actualAmount: null,
        isReplaced: false,
        replacedProductId: null,
        replacedProductName: null,
        weightRecordId: null,
        status: 'pending'
      };
    });

    const totalExpectedAmount = orderItems.reduce((sum, item) => sum + item.expectedAmount, 0);

    const order: Order = {
      id: uuidv4(),
      orderNo: data.orderNo,
      customerId: data.customerId,
      customerName: data.customerName,
      status: OrderStatus.PENDING,
      items: orderItems,
      totalExpectedAmount: Number(totalExpectedAmount.toFixed(2)),
      totalActualAmount: null,
      totalWeightDifference: null,
      totalRefundAmount: null,
      hasRefund: false,
      hasReplacement: false,
      outboundTime: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.saveOrder(order);
    return order;
  }

  getOrder(id: string): Order | undefined {
    return this.db.getOrder(id);
  }

  getOrderByNo(orderNo: string): Order | undefined {
    return this.db.getOrderByNo(orderNo);
  }

  getAllOrders(): Order[] {
    return this.db.getAllOrders();
  }

  updateOrderStatus(orderId: string, status: OrderStatus): Order {
    const order = this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = status;
    order.updatedAt = new Date();
    this.db.saveOrder(order);
    return order;
  }

  updateOrderItemWeight(
    orderId: string,
    orderItemId: string,
    actualWeight: number,
    weightRecordId: string
  ): Order {
    const order = this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.OUTBOUND) {
      throw new Error('Cannot modify weight after order is outbound');
    }

    const orderItem = order.items.find(item => item.id === orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found');
    }

    orderItem.actualWeight = actualWeight;
    orderItem.actualAmount = Number((actualWeight * orderItem.unitPrice).toFixed(2));
    orderItem.weightRecordId = weightRecordId;
    orderItem.status = 'weighed';

    const allWeighed = order.items.every(item => item.status === 'weighed');
    if (allWeighed) {
      order.status = OrderStatus.WEIGHED;
      this.calculateOrderTotals(order);
    } else {
      order.status = OrderStatus.WEIGHING;
    }

    order.updatedAt = new Date();
    this.db.saveOrder(order);
    return order;
  }

  replaceOrderItem(
    orderId: string,
    orderItemId: string,
    newProductId: string,
    actualWeight: number,
    weightRecordId: string
  ): Order {
    const order = this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.OUTBOUND) {
      throw new Error('Cannot modify items after order is outbound');
    }

    const orderItem = order.items.find(item => item.id === orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found');
    }

    const newProduct = this.db.getProduct(newProductId);
    if (!newProduct) {
      throw new Error('New product not found');
    }

    const priceDifference = newProduct.unitPrice - orderItem.unitPrice;
    if (priceDifference > 0) {
      throw new Error(`Replacement product price is higher by ${priceDifference.toFixed(2)} yuan, need approval`);
    }

    orderItem.isReplaced = true;
    orderItem.replacedProductId = newProductId;
    orderItem.replacedProductName = newProduct.name;
    orderItem.actualWeight = actualWeight;
    orderItem.unitPrice = newProduct.unitPrice;
    orderItem.actualAmount = Number((actualWeight * newProduct.unitPrice).toFixed(2));
    orderItem.weightRecordId = weightRecordId;
    orderItem.status = 'weighed';

    order.hasReplacement = true;

    const allWeighed = order.items.every(item => item.status === 'weighed');
    if (allWeighed) {
      order.status = OrderStatus.WEIGHED;
      this.calculateOrderTotals(order);
    }

    order.updatedAt = new Date();
    this.db.saveOrder(order);
    return order;
  }

  calculateOrderTotals(order: Order): void {
    const totalActualWeight = order.items.reduce((sum, item) => sum + (item.actualWeight || 0), 0);
    const totalExpectedWeight = order.items.reduce((sum, item) => sum + item.expectedWeight, 0);
    const totalActualAmount = order.items.reduce((sum, item) => sum + (item.actualAmount || 0), 0);

    order.totalActualAmount = Number(totalActualAmount.toFixed(2));
    order.totalWeightDifference = Number((totalActualWeight - totalExpectedWeight).toFixed(3));
    order.updatedAt = new Date();
  }

  confirmOutbound(orderId: string): Order {
    const order = this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatus.WEIGHED) {
      throw new Error('Order must be fully weighed before outbound');
    }

    const pendingItems = order.items.filter(item => item.status === 'pending');
    if (pendingItems.length > 0) {
      throw new Error(`There are ${pendingItems.length} items not weighed yet`);
    }

    order.status = OrderStatus.OUTBOUND;
    order.outboundTime = new Date();
    order.updatedAt = new Date();
    this.db.saveOrder(order);
    return order;
  }

  getWeightDifferenceSummary(orderId: string): WeightDifferenceSummary {
    const order = this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const totalExpectedWeight = order.items.reduce((sum, item) => sum + item.expectedWeight, 0);
    const totalActualWeight = order.items.reduce((sum, item) => sum + (item.actualWeight || 0), 0);
    const totalActualAmount = order.items.reduce((sum, item) => sum + (item.actualAmount || 0), 0);

    const weighedItems = order.items.filter(item => item.status === 'weighed').length;
    const pendingItems = order.items.length - weighedItems;
    const weightDifference = totalActualWeight - totalExpectedWeight;
    const differencePercentage = totalExpectedWeight > 0
      ? Math.abs((weightDifference / totalExpectedWeight) * 100)
      : 0;

    const abnormalItems: string[] = [];
    let hasAbnormalWeight = false;
    let hasHighValueReplacement = false;

    order.items.forEach(item => {
      if (item.actualWeight !== null && item.actualWeight !== undefined) {
        const product = this.db.getProduct(item.productId);
        if (product) {
          const itemDiffPercent = Math.abs(((item.actualWeight - item.expectedWeight) / item.expectedWeight) * 100);
          if (itemDiffPercent > product.tolerancePercentage) {
            abnormalItems.push(item.productName);
            hasAbnormalWeight = true;
          }
        }
      }

      if (item.isReplaced && item.replacedProductId) {
        const originalProduct = this.db.getProduct(item.productId);
        const newProduct = this.db.getProduct(item.replacedProductId);
        if (originalProduct && newProduct && newProduct.unitPrice > originalProduct.unitPrice) {
          hasHighValueReplacement = true;
        }
      }
    });

    const refundRecords = this.db.getRefundRecordsByOrder(orderId);
    const totalRefundAmount = refundRecords.reduce((sum, r) => sum + (r.status === 'processed' ? r.amount : 0), 0);

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      totalItems: order.items.length,
      weighedItems,
      pendingItems,
      totalExpectedWeight: Number(totalExpectedWeight.toFixed(3)),
      totalActualWeight: Number(totalActualWeight.toFixed(3)),
      totalWeightDifference: Number(weightDifference.toFixed(3)),
      differencePercentage: Number(differencePercentage.toFixed(2)),
      totalExpectedAmount: order.totalExpectedAmount,
      totalActualAmount: Number(totalActualAmount.toFixed(2)),
      totalRefundAmount: Number(totalRefundAmount.toFixed(2)),
      hasAbnormalWeight,
      hasHighValueReplacement,
      abnormalItems
    };
  }
}
