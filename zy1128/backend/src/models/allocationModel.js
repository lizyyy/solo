import db from '../config/database.js';

export const allocationModel = {
  findAll(filters = {}) {
    let sql = `
      SELECT al.*,
             r.expected_payout_id, r.expected_amount, r.actual_amount,
             r.difference, r.difference_type,
             ep.payout_date, ep.expected_principal, ep.expected_interest,
             p.product_code, p.product_name,
             h.holder_name,
             a.account_name
      FROM allocations al
      LEFT JOIN reconciliations r ON al.reconciliation_id = r.id
      LEFT JOIN expected_payouts ep ON r.expected_payout_id = ep.id
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN holders h ON al.holder_id = h.id
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.holder_id) {
      sql += ' AND al.holder_id = ?';
      params.push(filters.holder_id);
    }
    
    if (filters.start_date) {
      sql += ' AND ep.payout_date >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND ep.payout_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY ep.payout_date DESC, al.id DESC';
    
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return db.prepare(`
      SELECT al.*,
             r.expected_payout_id, r.expected_amount, r.actual_amount,
             r.difference, r.difference_type, r.manual_adjustment,
             ep.payout_date, ep.expected_principal, ep.expected_interest,
             ep.expected_management_fee, ep.expected_redemption_fee,
             p.product_code, p.product_name,
             h.holder_name,
             a.account_name
      FROM allocations al
      LEFT JOIN reconciliations r ON al.reconciliation_id = r.id
      LEFT JOIN expected_payouts ep ON r.expected_payout_id = ep.id
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN holders h ON al.holder_id = h.id
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE al.id = ?
    `).get(id);
  },

  findByReconciliationId(reconciliationId) {
    return db.prepare(`
      SELECT al.*, h.holder_name
      FROM allocations al
      LEFT JOIN holders h ON al.holder_id = h.id
      WHERE al.reconciliation_id = ?
      ORDER BY al.share_ratio DESC
    `).all(reconciliationId);
  },

  findByHolderId(holderId, filters = {}) {
    let sql = `
      SELECT al.*,
             r.expected_payout_id, r.expected_amount, r.actual_amount,
             r.difference, r.difference_type,
             ep.payout_date,
             p.product_code, p.product_name,
             a.account_name
      FROM allocations al
      LEFT JOIN reconciliations r ON al.reconciliation_id = r.id
      LEFT JOIN expected_payouts ep ON r.expected_payout_id = ep.id
      LEFT JOIN subscriptions s ON ep.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE al.holder_id = ?
    `;
    
    const params = [holderId];
    
    if (filters.start_date) {
      sql += ' AND ep.payout_date >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND ep.payout_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY ep.payout_date DESC';
    
    return db.prepare(sql).all(...params);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO allocations (
        reconciliation_id, holder_id, share_ratio,
        allocated_principal, allocated_interest,
        allocated_management_fee, allocated_redemption_fee,
        allocated_difference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.reconciliation_id,
      data.holder_id,
      data.share_ratio,
      data.allocated_principal || 0,
      data.allocated_interest || 0,
      data.allocated_management_fee || 0,
      data.allocated_redemption_fee || 0,
      data.allocated_difference || 0
    );
    
    return this.findById(result.lastInsertRowid);
  },

  delete(id) {
    return db.prepare(`DELETE FROM allocations WHERE id = ?`).run(id);
  },

  deleteByReconciliationId(reconciliationId) {
    return db.prepare(`DELETE FROM allocations WHERE reconciliation_id = ?`).run(reconciliationId);
  },

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM allocations WHERE 1=1`;
    const params = [];
    
    if (filters.holder_id) {
      sql += ' AND holder_id = ?';
      params.push(filters.holder_id);
    }
    
    return db.prepare(sql).get(...params).count;
  }
};

export default allocationModel;
