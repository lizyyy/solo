const Order = require('../models/Order');
const store = require('../data/memoryStore');
const logger = require('../utils/logger');

class OrderService {
  createOrder(orderData) {
    logger.info('创建订单', orderData.orderNo);
    const order = new Order(orderData);
    store.saveOrder(order);
    
    store.recordOperation({
      type: 'ORDER_CREATE',
      orderId: order.id,
      orderNo: order.orderNo,
      data: {
        userId: order.userId,
        groupLeaderId: order.groupLeaderId,
        itemCount: order.items.length
      }
    });
    
    return order;
  }

  getOrder(orderIdOrNo) {
    return store.getOrderById(orderIdOrNo) || store.getOrderByOrderNo(orderIdOrNo);
  }

  confirmDelivery(orderId, deliveryTime) {
    const order = this.getOrder(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    
    order.confirmDelivery(deliveryTime);
    store.saveOrder(order);
    
    store.recordOperation({
      type: 'ORDER_DELIVERY',
      orderId: order.id,
      orderNo: order.orderNo,
      data: {
        deliveryTime: order.deliveryTime
      }
    });
    
    return order;
  }

  addWeightConfirmation(orderId, itemId, actualWeight, photoUrl, operatorId, operatorName) {
    const order = this.getOrder(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    
    const item = order.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('商品不存在');
    }
    
    const oldWeight = order.getActualWeight(itemId);
    order.addWeightConfirmation(itemId, actualWeight, photoUrl);
    store.saveOrder(order);
    
    store.recordOperation({
      type: 'WEIGHT_CONFIRM',
      orderId: order.id,
      itemId,
      operatorId,
      operatorName,
      data: {
        expectedWeight: item.expectedWeight,
        oldWeight,
        newWeight: actualWeight,
        diff: actualWeight - item.expectedWeight,
        photoUrl
      }
    });
    
    return order;
  }

  leaderConfirm(orderId, operatorId, operatorName) {
    const order = this.getOrder(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    
    order.confirmByLeader();
    store.saveOrder(order);
    
    store.recordOperation({
      type: 'LEADER_CONFIRM',
      orderId: order.id,
      orderNo: order.orderNo,
      operatorId,
      operatorName,
      data: {
        leaderConfirmTime: order.leaderConfirmTime
      }
    });
    
    return order;
  }

  getOrderWeightChain(orderId) {
    const order = this.getOrder(orderId);
    if (!order) {
      return null;
    }

    const weightChain = order.items.map(item => {
      const confirmation = order.weightConfirmations.find(wc => wc.itemId === item.id);
      const actualWeight = confirmation ? confirmation.actualWeight : null;
      const diff = actualWeight !== null ? actualWeight - item.expectedWeight : null;
      
      return {
        itemId: item.id,
        productId: item.productId,
        productName: item.productName,
        expectedWeight: item.expectedWeight,
        actualWeight,
        diff,
        unit: item.unit,
        unitPrice: item.unitPrice,
        weightConfirmed: actualWeight !== null,
        confirmation: confirmation || null
      };
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      groupLeaderId: order.groupLeaderId,
      orderTime: order.orderTime,
      deliveryTime: order.deliveryTime,
      leaderConfirmed: order.leaderConfirmed,
      leaderConfirmTime: order.leaderConfirmTime,
      items: weightChain
    };
  }

  getAllOrders() {
    return store.getAllOrders();
  }
}

module.exports = new OrderService();
