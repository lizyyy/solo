import db from '../config/database.js';

export const payoutRuleModel = {
  findAll() {
    return db.prepare(`
      SELECT pr.*, p.product_code, p.product_name
      FROM payout_rules pr
      LEFT JOIN products p ON pr.product_id = p.id
      ORDER BY pr.created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`
      SELECT pr.*, p.product_code, p.product_name
      FROM payout_rules pr
      LEFT JOIN products p ON pr.product_id = p.id
      WHERE pr.id = ?
    `).get(id);
  },

  findByProductId(productId) {
    return db.prepare(`
      SELECT * FROM payout_rules WHERE product_id = ?
    `).get(productId);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO payout_rules (
        product_id, rule_type, management_fee_calculation,
        redemption_fee_calculation, payout_frequency
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.product_id,
      data.rule_type || 'actual/365',
      data.management_fee_calculation || 'daily_accrual',
      data.redemption_fee_calculation || 'fixed',
      data.payout_frequency || 'maturity'
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE payout_rules SET
        rule_type = ?,
        management_fee_calculation = ?,
        redemption_fee_calculation = ?,
        payout_frequency = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.rule_type || 'actual/365',
      data.management_fee_calculation || 'daily_accrual',
      data.redemption_fee_calculation || 'fixed',
      data.payout_frequency || 'maturity',
      id
    );
    
    return this.findById(id);
  },

  upsert(data) {
    const existing = this.findByProductId(data.product_id);
    
    if (existing) {
      return this.update(existing.id, data);
    } else {
      return this.create(data);
    }
  },

  delete(id) {
    return db.prepare(`DELETE FROM payout_rules WHERE id = ?`).run(id);
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as count FROM payout_rules`).get().count;
  }
};

export default payoutRuleModel;
