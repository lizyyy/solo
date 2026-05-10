class Inventory {
  static generateId(locationCode) {
    return `INV_${locationCode.toUpperCase()}`;
  }

  constructor(data) {
    this.inventoryId = Inventory.generateId(data.locationCode);
    this.locationId = Location.generateId(data.locationCode);
    this.locationCode = data.locationCode.toUpperCase();
    this.productId = Product.generateId(data.sku);
    this.sku = data.sku.toUpperCase();
    this.availableQty = parseInt(data.availableQty, 10);
    this.lockedQty = parseInt(data.lockedQty, 10) || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  get availableForAllocation() {
    return Math.max(0, this.availableQty - this.lockedQty);
  }

  toJSON() {
    return {
      inventoryId: this.inventoryId,
      locationId: this.locationId,
      locationCode: this.locationCode,
      productId: this.productId,
      sku: this.sku,
      availableQty: this.availableQty,
      lockedQty: this.lockedQty,
      availableForAllocation: this.availableForAllocation,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const Product = require('./Product');
const Location = require('./Location');
module.exports = Inventory;
