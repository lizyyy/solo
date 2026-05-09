class InventoryItem {
  constructor(options) {
    this.sku = options.sku;
    this.storeId = options.storeId;
    this.totalStock = options.totalStock || 0;
    this.availableStock = options.availableStock || this.totalStock;
    this.reservedStock = options.reservedStock || 0;
    this.updatedAt = options.updatedAt || Date.now();
  }
  
  reserve(quantity) {
    if (quantity <= 0) {
      return { success: false, reason: '预留数量必须大于0' };
    }
    
    if (this.availableStock < quantity) {
      return { 
        success: false, 
        reason: `库存不足，可用: ${this.availableStock}, 需要: ${quantity}` 
      };
    }
    
    this.availableStock -= quantity;
    this.reservedStock += quantity;
    this.updatedAt = Date.now();
    
    return { success: true };
  }
  
  restore(quantity) {
    if (quantity <= 0) {
      return { success: false, reason: '回补数量必须大于0' };
    }
    
    if (this.reservedStock < quantity) {
      return { 
        success: false, 
        reason: `预留库存不足，预留: ${this.reservedStock}, 需要回补: ${quantity}` 
      };
    }
    
    this.reservedStock -= quantity;
    this.availableStock += quantity;
    this.updatedAt = Date.now();
    
    return { success: true };
  }
  
  deduct(quantity) {
    if (quantity <= 0) {
      return { success: false, reason: '扣减数量必须大于0' };
    }
    
    if (this.reservedStock < quantity) {
      return { 
        success: false, 
        reason: `预留库存不足，预留: ${this.reservedStock}, 需要扣减: ${quantity}` 
      };
    }
    
    this.reservedStock -= quantity;
    this.totalStock -= quantity;
    this.updatedAt = Date.now();
    
    return { success: true };
  }
  
  toJSON() {
    return {
      sku: this.sku,
      storeId: this.storeId,
      totalStock: this.totalStock,
      availableStock: this.availableStock,
      reservedStock: this.reservedStock,
      updatedAt: this.updatedAt
    };
  }
  
  static fromJSON(data) {
    return new InventoryItem(data);
  }
}

class StockOperation {
  constructor(options) {
    this.operationId = options.operationId;
    this.orderId = options.orderId;
    this.storeId = options.storeId;
    this.sku = options.sku;
    this.quantity = options.quantity;
    this.operationType = options.operationType;
    this.timestamp = options.timestamp || Date.now();
    this.operator = options.operator || 'system';
    this.reason = options.reason || '';
    this.previousReserved = options.previousReserved;
    this.previousAvailable = options.previousAvailable;
    this.newReserved = options.newReserved;
    this.newAvailable = options.newAvailable;
  }
  
  toJSON() {
    return {
      operationId: this.operationId,
      orderId: this.orderId,
      storeId: this.storeId,
      sku: this.sku,
      quantity: this.quantity,
      operationType: this.operationType,
      timestamp: this.timestamp,
      operator: this.operator,
      reason: this.reason,
      previousReserved: this.previousReserved,
      previousAvailable: this.previousAvailable,
      newReserved: this.newReserved,
      newAvailable: this.newAvailable
    };
  }
  
  static fromJSON(data) {
    return new StockOperation(data);
  }
}

const StockOperationType = {
  RESERVE: 'reserve',
  RESTORE: 'restore',
  DEDUCT: 'deduct',
  ADJUST: 'adjust'
};

module.exports = { InventoryItem, StockOperation, StockOperationType };
