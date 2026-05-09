const storage = require('../storage/file-storage');
const { Order, OrderStatus } = require('../models/order');
const { generateOrderId, generateExtensionId, generateExceptionId } = require('../utils/id-generator');
const pickupCodeService = require('./pickup-code.service');
const inventoryService = require('./inventory.service');
const { ExceptionRecord, ExceptionType, ExceptionSeverity } = require('../models/exception');
const config = require('../config');

class OrderService {
  createOrder(options) {
    if (!options.storeId || !options.items || options.items.length === 0 || !options.customerPhone) {
      return { 
        success: false, 
        reason: '缺少必要参数：storeId、items、customerPhone' 
      };
    }
    
    if (!config.stores[options.storeId]) {
      return { success: false, reason: `门店 ${options.storeId} 不存在` };
    }
    
    const orderId = generateOrderId();
    const holdTime = options.holdTime || config.defaultHoldTime;
    
    const order = new Order({
      orderId: orderId,
      storeId: options.storeId,
      items: options.items,
      customerPhone: options.customerPhone,
      customerName: options.customerName || '',
      holdTime: holdTime,
      createdAt: Date.now()
    });
    
    const reserveResult = inventoryService.reserveStock(
      orderId, 
      options.storeId, 
      options.items
    );
    
    if (!reserveResult.success) {
      return {
        success: false,
        reason: reserveResult.reason,
        details: reserveResult.details
      };
    }
    
    order.stockReserved = true;
    
    let pickupCode;
    try {
      pickupCode = pickupCodeService.assignCode(orderId, options.storeId);
      order.pickupCode = pickupCode;
      order.pickupCodeGeneratedAt = Date.now();
    } catch (error) {
      inventoryService.restoreStock(orderId, options.storeId, options.items, '自提码生成失败，库存回滚');
      return {
        success: false,
        reason: error.message
      };
    }
    
    const orders = storage.getOrders();
    orders.push(order.toJSON());
    storage.saveOrders(orders);
    
    return {
      success: true,
      order: order.toJSON()
    };
  }
  
  getOrder(orderId) {
    const orders = storage.getOrders();
    const data = orders.find(o => o.orderId === orderId);
    return data ? Order.fromJSON(data) : null;
  }
  
  getOrdersByStore(storeId) {
    const orders = storage.getOrders();
    return orders.filter(o => o.storeId === storeId).map(o => Order.fromJSON(o));
  }
  
  getPendingOrders(storeId = null) {
    const orders = storage.getOrders();
    let pending = orders.filter(o => o.status === OrderStatus.PENDING);
    if (storeId) {
      pending = pending.filter(o => o.storeId === storeId);
    }
    return pending.map(o => Order.fromJSON(o));
  }
  
  validateAndPickup(code, storeId, operator = 'unknown') {
    const validation = pickupCodeService.validateCode(code, storeId);
    if (!validation.valid) {
      return {
        success: false,
        reason: validation.reason
      };
    }
    
    const order = this.getOrder(validation.orderId);
    if (!order) {
      this._recordException(null, ExceptionType.PICKUP_VALIDATION_FAILED, 
        '自提码有效但订单不存在', { code, storeId, orderId: validation.orderId });
      return {
        success: false,
        reason: '订单不存在'
      };
    }
    
    if (order.isExpired()) {
      return {
        success: false,
        reason: '订单已超时，无法核销'
      };
    }
    
    const confirmResult = order.confirmPickup(operator);
    if (!confirmResult.success) {
      return confirmResult;
    }
    
    const deductResult = inventoryService.deductStock(
      order.orderId, 
      order.storeId, 
      order.items
    );
    
    pickupCodeService.markCodeUsed(code, order.orderId);
    
    const orders = storage.getOrders();
    const index = orders.findIndex(o => o.orderId === order.orderId);
    if (index !== -1) {
      orders[index] = order.toJSON();
      storage.saveOrders(orders);
    }
    
    return {
      success: true,
      order: order.toJSON(),
      stockDeducted: deductResult.success
    };
  }
  
  extendOrder(orderId, additionalTime, extendedBy, reason) {
    const order = this.getOrder(orderId);
    if (!order) {
      return { success: false, reason: '订单不存在' };
    }
    
    const currentTotalTime = order.expiresAt - order.createdAt;
    const maxAllowed = config.maxHoldTime - currentTotalTime;
    
    if (maxAllowed <= 0) {
      this._recordException(orderId, ExceptionType.EXTENSION_EXCEEDED_LIMIT,
        '订单已达最大保留时长，无法继续延长',
        { currentTotalTime, maxHoldTime: config.maxHoldTime });
      return { success: false, reason: '已达最大保留时长限制' };
    }
    
    const actualTime = Math.min(additionalTime, maxAllowed);
    
    const extensionResult = order.extend(actualTime, extendedBy, reason);
    if (!extensionResult.success) {
      return extensionResult;
    }
    
    if (order.extensions.length > 0) {
      const lastExtension = order.extensions[order.extensions.length - 1];
      lastExtension.extensionId = generateExtensionId();
    }
    
    const orders = storage.getOrders();
    const index = orders.findIndex(o => o.orderId === order.orderId);
    if (index !== -1) {
      orders[index] = order.toJSON();
      storage.saveOrders(orders);
    }
    
    return {
      success: true,
      newExpiresAt: extensionResult.newExpiresAt,
      actualAdditionalTime: actualTime
    };
  }
  
  releaseExpiredOrder(orderId) {
    const order = this.getOrder(orderId);
    if (!order) {
      return { success: false, reason: '订单不存在' };
    }
    
    if (order.status !== OrderStatus.PENDING) {
      return { success: false, reason: '订单不在待处理状态' };
    }
    
    if (!order.isExpired()) {
      return { success: false, reason: '订单尚未超时' };
    }
    
    const releaseResult = order.releaseTimeout();
    if (!releaseResult.success) {
      this._recordException(orderId, ExceptionType.TIMEOUT_RELEASE_FAILED,
        releaseResult.reason, { status: order.status });
      return releaseResult;
    }
    
    if (order.stockReserved && !order.stockRestored) {
      const restoreResult = inventoryService.restoreStock(
        order.orderId,
        order.storeId,
        order.items
      );
      order.stockRestored = restoreResult.success;
    }
    
    const orders = storage.getOrders();
    const index = orders.findIndex(o => o.orderId === order.orderId);
    if (index !== -1) {
      orders[index] = order.toJSON();
      storage.saveOrders(orders);
    }
    
    return {
      success: true,
      order: order.toJSON()
    };
  }
  
  checkAndReleaseExpired(storeId = null) {
    const pendingOrders = this.getPendingOrders(storeId);
    const now = Date.now();
    const results = [];
    
    for (const order of pendingOrders) {
      if (order.isExpired(now)) {
        const releaseResult = this.releaseExpiredOrder(order.orderId);
        results.push({
          orderId: order.orderId,
          success: releaseResult.success,
          reason: releaseResult.reason || null
        });
      }
    }
    
    return {
      totalChecked: pendingOrders.length,
      releasedCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      details: results
    };
  }
  
  _recordException(orderId, type, message, details) {
    const exceptions = storage.getExceptions();
    const exception = new ExceptionRecord({
      exceptionId: generateExceptionId(),
      orderId: orderId,
      exceptionType: type,
      severity: ExceptionSeverity.ERROR,
      message: message,
      details: details
    });
    exceptions.push(exception.toJSON());
    storage.saveExceptions(exceptions);
  }
  
  getOrdersByStatus(status) {
    const orders = storage.getOrders();
    return orders.filter(o => o.status === status).map(o => Order.fromJSON(o));
  }
}

module.exports = new OrderService();
