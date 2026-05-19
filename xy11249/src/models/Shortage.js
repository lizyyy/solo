const { v4: uuidv4 } = require('uuid');

class Shortage {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.productId = data.productId;
    this.productName = data.productName;
    this.shortageDate = data.shortageDate ? new Date(data.shortageDate) : new Date();
    this.expectedQuantity = parseInt(data.expectedQuantity, 10);
    this.actualQuantity = parseInt(data.actualQuantity, 10);
    this.shortageQuantity = parseInt(data.shortageQuantity, 10);
    this.supplierId = data.supplierId;
    this.supplierName = data.supplierName;
    this.reason = data.reason || '';
    this.status = data.status || 'reported';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      productId: this.productId,
      productName: this.productName,
      shortageDate: this.shortageDate.toISOString().split('T')[0],
      expectedQuantity: this.expectedQuantity,
      actualQuantity: this.actualQuantity,
      shortageQuantity: this.shortageQuantity,
      supplierId: this.supplierId,
      supplierName: this.supplierName,
      reason: this.reason,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new Shortage(json);
  }
}

module.exports = Shortage;
