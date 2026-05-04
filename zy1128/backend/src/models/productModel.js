import db from '../config/database.js';

export const productModel = {
  findAll() {
    return db.prepare(`
      SELECT * FROM products ORDER BY created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`
      SELECT * FROM products WHERE id = ?
    `).get(id);
  },

  findByCode(productCode) {
    return db.prepare(`
      SELECT * FROM products WHERE product_code = ?
    `).get(productCode);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO products (
        product_code, product_name, product_type, platform,
        expected_annual_rate, management_fee_rate, redemption_fee_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.product_code,
      data.product_name,
      data.product_type,
      data.platform,
      data.expected_annual_rate,
      data.management_fee_rate,
      data.redemption_fee_rate
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE products SET
        product_name = ?,
        product_type = ?,
        platform = ?,
        expected_annual_rate = ?,
        management_fee_rate = ?,
        redemption_fee_rate = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.product_name,
      data.product_type,
      data.platform,
      data.expected_annual_rate,
      data.management_fee_rate,
      data.redemption_fee_rate,
      id
    );
    
    return this.findById(id);
  },

  upsert(data) {
    const existing = this.findByCode(data.product_code);
    
    if (existing) {
      return this.update(existing.id, data);
    } else {
      return this.create(data);
    }
  },

  delete(id) {
    return db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as count FROM products`).get().count;
  }
};

export default productModel;
