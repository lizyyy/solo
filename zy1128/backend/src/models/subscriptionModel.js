import db from '../config/database.js';

export const subscriptionModel = {
  findAll() {
    return db.prepare(`
      SELECT s.*, 
             p.product_code, p.product_name, p.product_type,
             a.account_name, a.bank_name,
             h.holder_name
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN accounts a ON s.account_id = a.id
      LEFT JOIN holders h ON s.holder_id = h.id
      ORDER BY s.created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`
      SELECT s.*, 
             p.product_code, p.product_name, p.product_type,
             p.expected_annual_rate, p.management_fee_rate, p.redemption_fee_rate,
             a.account_name, a.bank_name,
             h.holder_name
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN accounts a ON s.account_id = a.id
      LEFT JOIN holders h ON s.holder_id = h.id
      WHERE s.id = ?
    `).get(id);
  },

  findByProductId(productId) {
    return db.prepare(`
      SELECT s.*, h.holder_name
      FROM subscriptions s
      LEFT JOIN holders h ON s.holder_id = h.id
      WHERE s.product_id = ?
      ORDER BY s.share_ratio DESC
    `).all(productId);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO subscriptions (
        product_id, account_id, holder_id, principal, share_ratio,
        subscription_date, value_date, maturity_date, actual_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.product_id,
      data.account_id,
      data.holder_id,
      data.principal,
      data.share_ratio,
      data.subscription_date,
      data.value_date,
      data.maturity_date || null,
      data.actual_days || null,
      data.status || 'active'
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE subscriptions SET
        product_id = ?,
        account_id = ?,
        holder_id = ?,
        principal = ?,
        share_ratio = ?,
        subscription_date = ?,
        value_date = ?,
        maturity_date = ?,
        actual_days = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.product_id,
      data.account_id,
      data.holder_id,
      data.principal,
      data.share_ratio,
      data.subscription_date,
      data.value_date,
      data.maturity_date || null,
      data.actual_days || null,
      data.status || 'active',
      id
    );
    
    return this.findById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(id);
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as count FROM subscriptions`).get().count;
  }
};

export default subscriptionModel;
