class Inventory {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.medicineId = data.medicineId || '';
    this.medicineName = data.medicineName || '';
    this.batchNumber = data.batchNumber || '';
    this.quantity = data.quantity || 0;
    this.unit = data.unit || 'mg';
    this.expiryDate = data.expiryDate || '';
    this.location = data.location || '';
    this.supplier = data.supplier || '';
    this.costPrice = data.costPrice || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.medicineId) errors.push('药品ID不能为空');
    if (!this.batchNumber) errors.push('批号不能为空');
    if (this.quantity < 0) errors.push('库存数量不能为负数');
    if (!this.expiryDate) errors.push('有效期不能为空');
    return errors;
  }

  isExpired() {
    if (!this.expiryDate) return false;
    return new Date(this.expiryDate) < new Date();
  }

  daysUntilExpiry() {
    if (!this.expiryDate) return Infinity;
    const expiry = new Date(this.expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  deduct(amount) {
    if (amount > this.quantity) {
      throw new Error(`库存不足，当前库存: ${this.quantity}, 需要: ${amount}`);
    }
    this.quantity -= amount;
    this.updatedAt = new Date().toISOString();
    return this.quantity;
  }

  add(amount) {
    this.quantity += amount;
    this.updatedAt = new Date().toISOString();
    return this.quantity;
  }

  toJSON() {
    return {
      id: this.id,
      medicineId: this.medicineId,
      medicineName: this.medicineName,
      batchNumber: this.batchNumber,
      quantity: this.quantity,
      unit: this.unit,
      expiryDate: this.expiryDate,
      location: this.location,
      supplier: this.supplier,
      costPrice: this.costPrice,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Inventory(json);
  }
}

export default Inventory;
