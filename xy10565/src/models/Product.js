const BaseModel = require('./BaseModel');

class Product extends BaseModel {
  constructor() {
    super('products');
  }

  findBySku(sku) {
    return this.findOne('sku = ?', [sku]);
  }
}

module.exports = new Product();
