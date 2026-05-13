import { v4 as uuidv4 } from 'uuid';
import { dataStore } from './DataStore';
import { inventoryService } from './InventoryService';
import {
  Order,
  OrderItem,
  OrderStatus,
  TimelineEventType,
  OutOfStockItem,
  RefundCallback
} from '../types';

export class OrderService {
  async createOrder(
    orderData: {
      communityId: string;
      communityName: string;
      groupLeaderId: string;
      groupLeaderName: string;
      userId: string;
      userName: string;
      phone: string;
      address: string;
      items: Array<{ productId: string; quantity: number }>;
    },
    operatorId: string,
    operatorName: string
  ): Promise<{ order: Order; success: boolean; message?: string }> {
    const orderItems: OrderItem[] = [];
    let totalAmount = 0;

    for (const item of orderData.items) {
      const product = dataStore.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      const amount = product.price * item.quantity;
      totalAmount += amount;
      orderItems.push({
        id: uuidv4(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: product.price,
        amount,
        status: 'NORMAL'
      });
    }

    const order = dataStore.createOrder({
      ...orderData,
      items: orderItems,
      totalAmount,
      actualAmount: totalAmount
    });

    dataStore.addTimelineEvent(order.id, {
      eventType: TimelineEventType.ORDER_CREATED,
      eventName: '订单创建',
      description: `创建小区团单，订单号：${order.orderNo}，共 ${orderItems.length} 件商品，总金额：¥${totalAmount.toFixed(2)}`,
      operatorId,
      operatorName,
      details: { orderNo: order.orderNo, itemCount: orderItems.length, totalAmount }
    });

    return { order, success: true };
  }

  async payOrder(orderId: string, operatorId: string, operatorName: string): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.CREATED) {
      return { order, success: false, message: '订单状态不允许支付' };
    }

    const inventoryResult = await inventoryService.blockInventory(orderId, order.items, operatorId, operatorName);
    if (!inventoryResult.success) {
      for (const item of inventoryResult.outOfStockItems) {
        const orderItem = order.items.find((i) => i.productId === item.productId);
        if (orderItem) {
          dataStore.addOutOfStockItem({
            orderId,
            orderItemId: orderItem.id,
            productId: item.productId,
            productName: item.productName,
            sku: orderItem.sku,
            requestedQuantity: item.requested,
            availableQuantity: item.available,
            shortageQuantity: item.requested - item.available,
            detectedAt: new Date().toISOString(),
            resolved: false
          });
        }
      }
      dataStore.addTimelineEvent(orderId, {
        eventType: TimelineEventType.OUT_OF_STOCK_DETECTED,
        eventName: '缺货检测',
        description: `检测到 ${inventoryResult.outOfStockItems.length} 件商品缺货`,
        operatorId,
        operatorName,
        details: { outOfStockItems: inventoryResult.outOfStockItems }
      });
      return { order, success: false, message: '部分商品缺货' };
    }

    const oldStatus = order.status;
    order.status = OrderStatus.PAID;
    dataStore.updateOrder(order);

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.STATUS_CHANGED,
      eventName: '状态变更',
      description: `订单支付成功，状态从 ${oldStatus} 变更为 ${OrderStatus.PAID}`,
      operatorId,
      operatorName,
      details: { oldStatus, newStatus: OrderStatus.PAID }
    });

    return { order, success: true };
  }

  async confirmReplacement(
    orderId: string,
    orderItemId: string,
    replacementProductId: string,
    operatorId: string,
    operatorName: string,
    reason?: string
  ): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    const orderItem = order.items.find((i) => i.id === orderItemId);
    if (!orderItem) {
      return { order, success: false, message: '订单项不存在' };
    }

    const replacementProduct = dataStore.getProduct(replacementProductId);
    if (!replacementProduct) {
      return { order, success: false, message: '替换商品不存在' };
    }

    const oldProductId = orderItem.productId;
    const oldProductName = orderItem.productName;
    const oldSku = orderItem.sku;

    await inventoryService.releaseInventory(
      orderId,
      [{ ...orderItem }],
      operatorId,
      operatorName,
      `商品替换：${oldProductName} -> ${replacementProduct.name}`
    );

    const replacementResult = await inventoryService.blockInventory(
      orderId,
      [{ ...orderItem, productId: replacementProductId, productName: replacementProduct.name, sku: replacementProduct.sku }],
      operatorId,
      operatorName
    );

    if (!replacementResult.success) {
      return { order, success: false, message: '替换商品库存不足' };
    }

    dataStore.addModifiedRecord(orderId, {
      type: 'REPLACEMENT',
      field: 'product',
      oldValue: `ID: ${oldProductId}, 名称: ${oldProductName}, SKU: ${oldSku}`,
      newValue: `ID: ${replacementProductId}, 名称: ${replacementProduct.name}, SKU: ${replacementProduct.sku}`,
      operatorId,
      operatorName,
      reason
    });

    orderItem.productId = replacementProductId;
    orderItem.productName = replacementProduct.name;
    orderItem.sku = replacementProduct.sku;
    orderItem.status = 'REPLACED';
    orderItem.replacementProductId = replacementProductId;
    orderItem.replacementProductName = replacementProduct.name;

    const oldAmount = orderItem.amount;
    const newAmount = replacementProduct.price * orderItem.quantity;
    const priceDiff = newAmount - oldAmount;

    orderItem.price = replacementProduct.price;
    orderItem.amount = newAmount;
    order.totalAmount += priceDiff;
    order.actualAmount += priceDiff;

    if (priceDiff !== 0) {
      dataStore.addModifiedRecord(orderId, {
        type: 'REPLACEMENT',
        field: 'amount',
        oldValue: oldAmount.toString(),
        newValue: newAmount.toString(),
        operatorId,
        operatorName,
        reason: `商品替换导致价格${priceDiff > 0 ? '上涨' : '下降'}`
      });
    }

    dataStore.updateOrder(order);

    const outOfStockItems = dataStore.getOutOfStockItems(orderId);
    const targetOosItem = outOfStockItems.find((i) => i.orderItemId === orderItemId);
    if (targetOosItem) {
      targetOosItem.resolved = true;
      targetOosItem.resolution = 'REPLACEMENT';
      dataStore.updateOutOfStockItem(targetOosItem);
    }

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.REPLACEMENT_CONFIRMED,
      eventName: '替换品确认',
      description: `商品 ${oldProductName} 已替换为 ${replacementProduct.name}`,
      operatorId,
      operatorName,
      details: {
        oldProduct: { id: oldProductId, name: oldProductName },
        newProduct: { id: replacementProductId, name: replacementProduct.name },
        priceDiff
      }
    });

    return { order, success: true };
  }

  async processRefundCallback(callbackData: {
    orderId: string;
    orderItemId?: string;
    callbackId: string;
    refundAmount: number;
    status: 'SUCCESS' | 'FAILED';
  }): Promise<{ success: boolean; message: string; isDuplicate: boolean }> {
    const existingCallback = dataStore.getRefundCallback(callbackData.callbackId);
    if (existingCallback) {
      return { success: existingCallback.processed, message: '重复回调', isDuplicate: true };
    }

    const callback: RefundCallback = {
      id: uuidv4(),
      ...callbackData,
      processed: false,
      receivedAt: new Date().toISOString()
    };
    dataStore.saveRefundCallback(callback);

    const order = dataStore.getOrder(callbackData.orderId);
    if (!order) {
      return { success: false, message: '订单不存在', isDuplicate: false };
    }

    if (callbackData.status === 'SUCCESS') {
      const operatorId = 'system';
      const operatorName = '系统自动处理';

      const orderItem = callbackData.orderItemId
        ? order.items.find((i) => i.id === callbackData.orderItemId)
        : null;

      dataStore.addModifiedRecord(order.id, {
        type: 'REFUND',
        field: orderItem ? 'itemRefundAmount' : 'orderRefundAmount',
        oldValue: (orderItem?.refundAmount || 0).toString(),
        newValue: callbackData.refundAmount.toString(),
        operatorId,
        operatorName,
        reason: '退款回调处理'
      });

      if (orderItem) {
        orderItem.status = 'REFUNDED';
        orderItem.refundAmount = (orderItem.refundAmount || 0) + callbackData.refundAmount;
        await inventoryService.releaseInventory(
          order.id,
          [{ ...orderItem }],
          operatorId,
          operatorName,
          `退款释放库存：${orderItem.productName}`
        );
      } else {
        for (const item of order.items) {
          if (item.status !== 'REFUNDED') {
            item.status = 'REFUNDED';
            item.refundAmount = item.amount;
          }
        }
        await inventoryService.releaseInventory(order.id, order.items, operatorId, operatorName, '订单全额退款');
      }

      order.refundAmount += callbackData.refundAmount;
      order.actualAmount = Math.max(0, order.totalAmount - order.refundAmount);

      const allItemsRefunded = order.items.every((item) => item.status === 'REFUNDED');
      if (allItemsRefunded) {
        const oldStatus = order.status;
        order.status = OrderStatus.REFUNDED;
        dataStore.addTimelineEvent(order.id, {
          eventType: TimelineEventType.STATUS_CHANGED,
          eventName: '状态变更',
          description: `订单已全额退款，状态从 ${oldStatus} 变更为 ${OrderStatus.REFUNDED}`,
          operatorId,
          operatorName,
          details: { oldStatus, newStatus: OrderStatus.REFUNDED }
        });
      }

      dataStore.updateOrder(order);

      if (orderItem) {
        const outOfStockItems = dataStore.getOutOfStockItems(order.id);
        const targetOosItem = outOfStockItems.find((i) => i.orderItemId === callbackData.orderItemId);
        if (targetOosItem) {
          targetOosItem.resolved = true;
          targetOosItem.resolution = 'REFUND';
          dataStore.updateOutOfStockItem(targetOosItem);
        }
      }
    }

    callback.processed = true;
    callback.processedAt = new Date().toISOString();
    dataStore.saveRefundCallback(callback);

    dataStore.addTimelineEvent(callbackData.orderId, {
      eventType: TimelineEventType.REFUND_CALLBACK,
      eventName: '退款回调',
      description: `退款回调处理完成，退款金额：¥${callbackData.refundAmount.toFixed(2)}，状态：${callbackData.status}`,
      operatorId: 'system',
      operatorName: '系统自动处理',
      details: {
        callbackId: callbackData.callbackId,
        refundAmount: callbackData.refundAmount,
        status: callbackData.status,
        isDuplicate: false
      }
    });

    return { success: true, message: '退款回调处理成功', isDuplicate: false };
  }

  async startPicking(orderId: string, operatorId: string, operatorName: string): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.PAID) {
      return { order, success: false, message: '只有已支付订单才能开始拣货' };
    }

    const oldStatus = order.status;
    order.status = OrderStatus.PICKING;
    dataStore.updateOrder(order);

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.PICKING_STARTED,
      eventName: '开始拣货',
      description: `团长开始拣货，订单状态从 ${oldStatus} 变更为 ${OrderStatus.PICKING}`,
      operatorId,
      operatorName,
      details: { oldStatus, newStatus: OrderStatus.PICKING }
    });

    return { order, success: true };
  }

  async recordPicking(
    orderId: string,
    orderItemId: string,
    pickedQuantity: number,
    operatorId: string,
    operatorName: string,
    notes?: string
  ): Promise<{ success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.PICKING) {
      return { success: false, message: '订单不在拣货状态' };
    }

    const orderItem = order.items.find((i) => i.id === orderItemId);
    if (!orderItem) {
      return { success: false, message: '订单项不存在' };
    }

    dataStore.addPickingRecord({
      orderId,
      orderItemId,
      productId: orderItem.productId,
      productName: orderItem.productName,
      sku: orderItem.sku,
      pickedQuantity,
      operatorId,
      operatorName,
      pickedAt: new Date().toISOString(),
      notes
    });

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.PICKING_RECORD,
      eventName: '拣货记录',
      description: `拣货：${orderItem.productName} x ${pickedQuantity}`,
      operatorId,
      operatorName,
      details: {
        orderItemId,
        productName: orderItem.productName,
        pickedQuantity,
        notes
      }
    });

    return { success: true };
  }

  async completePicking(orderId: string, operatorId: string, operatorName: string): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.PICKING) {
      return { order, success: false, message: '订单不在拣货状态' };
    }

    await inventoryService.deductInventory(orderId, order.items, operatorId, operatorName);

    const oldStatus = order.status;
    order.status = OrderStatus.PICKED;
    dataStore.updateOrder(order);

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.PICKING_COMPLETED,
      eventName: '拣货完成',
      description: `团长拣货完成，订单状态从 ${oldStatus} 变更为 ${OrderStatus.PICKED}`,
      operatorId,
      operatorName,
      details: { oldStatus, newStatus: OrderStatus.PICKED }
    });

    return { order, success: true };
  }

  async deliverOrder(orderId: string, operatorId: string, operatorName: string): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.PICKED) {
      return { order, success: false, message: '只有已拣货订单才能配送' };
    }

    const oldStatus = order.status;
    order.status = OrderStatus.DELIVERED;
    dataStore.updateOrder(order);

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.STATUS_CHANGED,
      eventName: '状态变更',
      description: `订单已配送，状态从 ${oldStatus} 变更为 ${OrderStatus.DELIVERED}`,
      operatorId,
      operatorName,
      details: { oldStatus, newStatus: OrderStatus.DELIVERED }
    });

    return { order, success: true };
  }

  async completeOrder(orderId: string, operatorId: string, operatorName: string): Promise<{ order: Order; success: boolean; message?: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { order: {} as Order, success: false, message: '订单不存在' };
    }

    if (order.status !== OrderStatus.DELIVERED) {
      return { order, success: false, message: '只有已配送订单才能完成' };
    }

    const oldStatus = order.status;
    order.status = OrderStatus.COMPLETED;
    dataStore.updateOrder(order);

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.STATUS_CHANGED,
      eventName: '状态变更',
      description: `订单已完成，状态从 ${oldStatus} 变更为 ${OrderStatus.COMPLETED}`,
      operatorId,
      operatorName,
      details: { oldStatus, newStatus: OrderStatus.COMPLETED }
    });

    return { order, success: true };
  }

  getOrder(orderId: string): Order | undefined {
    return dataStore.getOrder(orderId);
  }

  getAllOrders(): Order[] {
    return dataStore.getAllOrders();
  }

  getOutOfStockItems(orderId: string): OutOfStockItem[] {
    return dataStore.getOutOfStockItems(orderId);
  }
}

export const orderService = new OrderService();
