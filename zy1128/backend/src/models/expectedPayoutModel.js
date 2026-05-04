import db from '../config/database.js';

export const expectedPayoutModel = {
  findAll(filters = {}) {
    let sql = `
      SELECT ep.*,
             s.principal, s.share_ratio, s.value_date, s.maturity_date, s.status as subscription_status,
             p.product_code, p.product_name, p.product_type,
             a.account_name, a.bank_name,
             h.holder_name
      FROM expected_payouts ep
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN accounts a ON s.account_id = a.id
      LEFT JOIN holders h ON s.holder_id = h.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.account_id) {
      sql += ' AND s.account_id = ?';
      params.push(filters.account_id);
    }
    
    if (filters.product_id) {
      sql += ' AND s.product_id = ?';
      params.push(filters.product_id);
    }
    
    if (filters.holder_id) {
      sql += ' AND s.holder_id = ?';
      params.push(filters.holder_id);
    }
    
    if (filters.status) {
      sql += ' AND ep.status = ?';
      params.push(filters.status);
    }
    
    if (filters.start_date) {
      sql += ' AND ep.payout_date >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND ep.payout_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY ep.payout_date DESC, ep.id DESC';
    
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return db.prepare(`
      SELECT ep.*,
             s.principal, s.share_ratio, s.value_date, s.maturity_date, s.status as subscription_status,
             p.product_code, p.product_name, p.product_type,
             p.expected_annual_rate, p.management_fee_rate, p.redemption_fee_rate,
             a.account_name, a.bank_name,
             h.holder_name
      FROM expected_payouts ep
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN accounts a ON s.account_id = a.id
      LEFT JOIN holders h ON s.holder_id = h.id
      WHERE ep.id = ?
    `).get(id);
  },

  findBySubscriptionId(subscriptionId) {
    return db.prepare(`
      SELECT * FROM expected_payouts 
      WHERE subscription_id = ? 
      ORDER BY payout_date
    `).all(subscriptionId);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO expected_payouts (
        subscription_id, payout_date, expected_principal, expected_interest,
        expected_management_fee, expected_redemption_fee, expected_total,
        status, period_start, period_end, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.subscription_id,
      data.payout_date,
      data.expected_principal || 0,
      data.expected_interest || 0,
      data.expected_management_fee || 0,
      data.expected_redemption_fee || 0,
      data.expected_total || 0,
      data.status || 'pending',
      data.period_start || null,
      data.period_end || null,
      data.notes || null
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE expected_payouts SET
        payout_date = ?,
        expected_principal = ?,
        expected_interest = ?,
        expected_management_fee = ?,
        expected_redemption_fee = ?,
        expected_total = ?,
        status = ?,
        period_start = ?,
        period_end = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.payout_date,
      data.expected_principal || 0,
      data.expected_interest || 0,
      data.expected_management_fee || 0,
      data.expected_redemption_fee || 0,
      data.expected_total || 0,
      data.status || 'pending',
      data.period_start || null,
      data.period_end || null,
      data.notes || null,
      id
    );
    
    return this.findById(id);
  },

  updateStatus(id, status) {
    const stmt = db.prepare(`
      UPDATE expected_payouts SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(status, id);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM expected_payouts WHERE id = ?`).run(id);
  },

  deleteBySubscriptionId(subscriptionId) {
    return db.prepare(`DELETE FROM expected_payouts WHERE subscription_id = ?`).run(subscriptionId);
  },

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM expected_payouts WHERE 1=1`;
    const params = [];
    
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    
    return db.prepare(sql).get(...params).count;
  }
};

export default expectedPayoutModel;
