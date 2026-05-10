class Product {
  static generateId(sku) {
    return `PROD_${sku.toUpperCase()}`;
  }

  constructor(data) {
    this.productId = Product.generateId(data.sku);
    this.sku = data.sku.toUpperCase();
    this.name = data.name;
    this.category = data.category || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      productId: this.productId,
      sku: this.sku,
      name: this.name,
      category: this.category,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Product;
