const BaseModel = require('./BaseModel');

class Device extends BaseModel {
  constructor() {
    super('devices');
  }

  findBySN(sn) {
    return this.findOne('sn = ?', [sn]);
  }

  findAvailableByProductId(productId) {
    return this.findOne('product_id = ? AND status = ? AND is_new = 1', [productId, 'AVAILABLE']);
  }

  findAllByProductId(productId) {
    return this.findAll('product_id = ?', [productId]);
  }

  countAvailableByProductId(productId) {
    return this.count('product_id = ? AND status = ? AND is_new = 1', [productId, 'AVAILABLE']);
  }

  updateStatus(id, status, operator = null) {
    const device = this.findById(id);
    if (!device) return null;

    return this.update(id, { status });
  }
}

module.exports = new Device();
