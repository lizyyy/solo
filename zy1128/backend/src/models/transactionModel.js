import db from '../config/database.js';

export const transactionModel = {
  findAll(filters = {}) {
    let sql = `
      SELECT t.*, a.account_name, a.bank_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.account_id) {
      sql += ' AND t.account_id = ?';
      params.push(filters.account_id);
    }
    
    if (filters.matched !== undefined) {
      sql += ' AND t.matched = ?';
      params.push(filters.matched ? 1 : 0);
    }
    
    if (filters.start_date) {
      sql += ' AND t.transaction_date >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND t.transaction_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY t.transaction_date DESC, t.id DESC';
    
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return db.prepare(`
      SELECT t.*, a.account_name, a.bank_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `).get(id);
  },

  findUnmatched(accountId = null) {
    let sql = `
      SELECT t.*, a.account_name, a.bank_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.matched = 0
    `;
    
    const params = [];
    
    if (accountId) {
      sql += ' AND t.account_id = ?';
      params.push(accountId);
    }
    
    sql += ' ORDER BY t.transaction_date';
    
    return db.prepare(sql).all(...params);
  },

  findByAmount(amount, accountId = null, tolerance = 0.01) {
    let sql = `
      SELECT t.*, a.account_name, a.bank_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.matched = 0 AND ABS(t.transaction_amount - ?) <= ?
    `;
    
    const params = [amount, tolerance];
    
    if (accountId) {
      sql += ' AND t.account_id = ?';
      params.push(accountId);
    }
    
    sql += ' ORDER BY t.transaction_date';
    
    return db.prepare(sql).all(...params);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        account_id, transaction_date, transaction_amount,
        transaction_type, description, reference_number, matched
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.account_id,
      data.transaction_date,
      data.transaction_amount,
      data.transaction_type,
      data.description || null,
      data.reference_number || null,
      data.matched || 0
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE transactions SET
        account_id = ?,
        transaction_date = ?,
        transaction_amount = ?,
        transaction_type = ?,
        description = ?,
        reference_number = ?,
        matched = ?
      WHERE id = ?
    `);
    
    stmt.run(
      data.account_id,
      data.transaction_date,
      data.transaction_amount,
      data.transaction_type,
      data.description || null,
      data.reference_number || null,
      data.matched || 0,
      id
    );
    
    return this.findById(id);
  },

  markAsMatched(id) {
    return db.prepare(`
      UPDATE transactions SET matched = 1 WHERE id = ?
    `).run(id);
  },

  markAsUnmatched(id) {
    return db.prepare(`
      UPDATE transactions SET matched = 0 WHERE id = ?
    `).run(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  },

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM transactions WHERE 1=1`;
    const params = [];
    
    if (filters.matched !== undefined) {
      sql += ' AND matched = ?';
      params.push(filters.matched ? 1 : 0);
    }
    
    return db.prepare(sql).get(...params).count;
  }
};

export default transactionModel;
