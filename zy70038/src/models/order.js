const config = require('../config');

class Order {
  constructor(options) {
    this.orderId = options.orderId;
    this.storeId = options.storeId;
    this.items = options.items || [];
    this.customerPhone = options.customerPhone;
    this.customerName = options.customerName || '';
    
    this.pickupCode = options.pickupCode || null;
    this.pickupCodeGeneratedAt = options.pickupCodeGeneratedAt || null;
    
    this.holdTime = options.holdTime || config.defaultHoldTime;
    this.createdAt = options.createdAt || Date.now();
    this.expiresAt = options.expiresAt || (this.createdAt + this.holdTime);
    
    this.status = options.status || 'pending';
    
    this.pickedUpAt = options.pickedUpAt || null;
    this.pickedUpBy = options.pickedUpBy || null;
    
    this.timeoutReleasedAt = options.timeoutReleasedAt || null;
    
    this.extensions = options.extensions || [];
    this.totalHoldTime = options.totalHoldTime || this.holdTime;
    
    this.stockReserved = options.stockReserved || false;
    this.stockRestored = options.stockRestored || false;
  }
  
  isExpired(now = Date.now()) {
    return this.status === 'pending' && now >= this.expiresAt;
  }
  
  canExtend() {
    if (this.status !== 'pending') return false;
    const usedTime = this.expiresAt - this.createdAt;
    return usedTime < config.maxHoldTime;
  }
  
  extend(additionalTime, extendedBy, reason) {
    if (!this.canExtend()) {
      return { success: false, reason: '无法延长：订单状态或已达最大保留时长' };
    }
    
    const usedTime = this.expiresAt - this.createdAt;
    const availableTime = config.maxHoldTime - usedTime;
    const actualAdditionalTime = Math.min(additionalTime, availableTime);
    
    this.expiresAt += actualAdditionalTime;
    this.totalHoldTime += actualAdditionalTime;
    
    this.extensions.push({
      extensionId: null,
      additionalTime: actualAdditionalTime,
      extendedAt: Date.now(),
      extendedBy: extendedBy,
      reason: reason,
      previousExpiresAt: this.expiresAt - actualAdditionalTime,
      newExpiresAt: this.expiresAt
    });
    
    return { 
      success: true, 
      newExpiresAt: this.expiresAt,
      actualAdditionalTime: actualAdditionalTime
    };
  }
  
  validatePickupCode(code) {
    return this.status === 'pending' && 
           this.pickupCode !== null && 
           this.pickupCode === code &&
           !this.isExpired();
  }
  
  confirmPickup(pickedUpBy = 'unknown') {
    if (this.status !== 'pending') {
      return { success: false, reason: '订单不在待核销状态' };
    }
    
    if (this.isExpired()) {
      return { success: false, reason: '订单已超时，无法核销' };
    }
    
    this.status = 'picked_up';
    this.pickedUpAt = Date.now();
    this.pickedUpBy = pickedUpBy;
    
    return { success: true };
  }
  
  releaseTimeout() {
    if (this.status !== 'pending') {
      return { success: false, reason: '订单不在待核销状态' };
    }
    
    this.status = 'timeout_released';
    this.timeoutReleasedAt = Date.now();
    
    return { success: true };
  }
  
  toJSON() {
    return {
      orderId: this.orderId,
      storeId: this.storeId,
      items: this.items,
      customerPhone: this.customerPhone,
      customerName: this.customerName,
      pickupCode: this.pickupCode,
      pickupCodeGeneratedAt: this.pickupCodeGeneratedAt,
      holdTime: this.holdTime,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      status: this.status,
      pickedUpAt: this.pickedUpAt,
      pickedUpBy: this.pickedUpBy,
      timeoutReleasedAt: this.timeoutReleasedAt,
      extensions: this.extensions,
      totalHoldTime: this.totalHoldTime,
      stockReserved: this.stockReserved,
      stockRestored: this.stockRestored
    };
  }
  
  static fromJSON(data) {
    return new Order(data);
  }
}

const OrderStatus = {
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  TIMEOUT_RELEASED: 'timeout_released',
  CANCELLED: 'cancelled'
};

module.exports = { Order, OrderStatus };
