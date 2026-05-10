class InventoryLock {
  static STATUS = {
    ACTIVE: 'ACTIVE',
    RELEASED: 'RELEASED',
    CONSUMED: 'CONSUMED'
  };

  static generateId(waveId, orderId, sku, locationCode) {
    return `LOCK_${waveId}_${orderId}_${sku.toUpperCase()}_${locationCode.toUpperCase()}`;
  }

  static generateKey(waveId, orderId, sku, locationCode) {
    return `${waveId}|${orderId}|${sku.toUpperCase()}|${locationCode.toUpperCase()}`;
  }

  constructor(data) {
    this.lockId = InventoryLock.generateId(
      data.waveId,
      data.orderId,
      data.sku,
      data.locationCode
    );
    this.lockKey = InventoryLock.generateKey(
      data.waveId,
      data.orderId,
      data.sku,
      data.locationCode
    );
    this.waveId = data.waveId;
    this.orderId = data.orderId;
    this.inventoryId = Inventory.generateId(data.locationCode);
    this.locationId = Location.generateId(data.locationCode);
    this.locationCode = data.locationCode.toUpperCase();
    this.productId = Product.generateId(data.sku);
    this.sku = data.sku.toUpperCase();
    this.qty = parseInt(data.qty, 10);
    this.status = data.status || InventoryLock.STATUS.ACTIVE;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  get isActive() {
    return this.status === InventoryLock.STATUS.ACTIVE;
  }

  toJSON() {
    return {
      lockId: this.lockId,
      lockKey: this.lockKey,
      waveId: this.waveId,
      orderId: this.orderId,
      inventoryId: this.inventoryId,
      locationId: this.locationId,
      locationCode: this.locationCode,
      productId: this.productId,
      sku: this.sku,
      qty: this.qty,
      status: this.status,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const Product = require('./Product');
const Location = require('./Location');
const Inventory = require('./Inventory');
module.exports = InventoryLock;
