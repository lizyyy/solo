import db from '../config/database.js';

export const reconciliationModel = {
  findAll(filters = {}) {
    let sql = `
      SELECT r.*,
             ep.payout_date, ep.expected_total,
             ep.subscription_id, ep.expected_principal, ep.expected_interest,
             ep.expected_management_fee, ep.expected_redemption_fee,
             t.transaction_date, t.transaction_amount, t.description as transaction_description,
             s.product_id, s.holder_id, s.account_id,
             p.product_code, p.product_name,
             h.holder_name,
             a.account_name, a.bank_name
      FROM reconciliations r
      LEFT JOIN expected_payouts ep ON r.expected_payout_id = ep.id
      LEFT JOIN transactions t ON r.transaction_id = t.id
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN holders h ON s.holder_id = h.id
      LEFT JOIN accounts a ON s.account_id = a.id
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
    
    if (filters.difference_type) {
      sql += ' AND r.difference_type = ?';
      params.push(filters.difference_type);
    }
    
    if (filters.start_date) {
      sql += ' AND ep.payout_date >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND ep.payout_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY ep.payout_date DESC, r.id DESC';
    
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return db.prepare(`
      SELECT r.*,
             ep.payout_date, ep.expected_total,
             ep.subscription_id, ep.expected_principal, ep.expected_interest,
             ep.expected_management_fee, ep.expected_redemption_fee,
             ep.status as payout_status,
             t.transaction_date, t.transaction_amount, t.description as transaction_description,
             t.reference_number,
             s.product_id, s.holder_id, s.account_id,
             s.principal, s.share_ratio, s.value_date, s.maturity_date,
             p.product_code, p.product_name, p.product_type,
             p.expected_annual_rate, p.management_fee_rate, p.redemption_fee_rate,
             h.holder_name,
             a.account_name, a.bank_name
      FROM reconciliations r
      LEFT JOIN expected_payouts ep ON r.expected_payout_id = ep.id
      LEFT JOIN transactions t ON r.transaction_id = t.id
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN holders h ON s.holder_id = h.id
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE r.id = ?
    `).get(id);
  },

  findByExpectedPayoutId(expectedPayoutId) {
    return db.prepare(`
      SELECT * FROM reconciliations WHERE expected_payout_id = ?
      ORDER BY match_date DESC
    `).all(expectedPayoutId);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO reconciliations (
        expected_payout_id, transaction_id, match_date,
        expected_amount, actual_amount, difference, difference_type,
        manual_adjustment
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.expected_payout_id,
      data.transaction_id || null,
      data.expected_amount,
      data.actual_amount !== undefined ? data.actual_amount : null,
      data.difference !== undefined ? data.difference : null,
      data.difference_type || null,
      data.manual_adjustment || null
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE reconciliations SET
        expected_payout_id = ?,
        transaction_id = ?,
        expected_amount = ?,
        actual_amount = ?,
        difference = ?,
        difference_type = ?,
        manual_adjustment = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.expected_payout_id,
      data.transaction_id || null,
      data.expected_amount,
      data.actual_amount !== undefined ? data.actual_amount : null,
      data.difference !== undefined ? data.difference : null,
      data.difference_type || null,
      data.manual_adjustment || null,
      id
    );
    
    return this.findById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM reconciliations WHERE id = ?`).run(id);
  },

  deleteByExpectedPayoutId(expectedPayoutId) {
    return db.prepare(`DELETE FROM reconciliations WHERE expected_payout_id = ?`).run(expectedPayoutId);
  },

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM reconciliations WHERE 1=1`;
    const params = [];
    
    if (filters.difference_type) {
      sql += ' AND difference_type = ?';
      params.push(filters.difference_type);
    }
    
    return db.prepare(sql).get(...params).count;
  }
};

export default reconciliationModel;
