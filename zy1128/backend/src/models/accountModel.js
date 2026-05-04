import db from '../config/database.js';

export const accountModel = {
  findAll() {
    return db.prepare(`
      SELECT * FROM accounts ORDER BY created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`
      SELECT * FROM accounts WHERE id = ?
    `).get(id);
  },

  findByName(accountName) {
    return db.prepare(`
      SELECT * FROM accounts WHERE account_name = ?
    `).get(accountName);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO accounts (account_name, account_number, bank_name)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
      data.account_name,
      data.account_number || null,
      data.bank_name
    );
    
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE accounts SET
        account_name = ?,
        account_number = ?,
        bank_name = ?
      WHERE id = ?
    `);
    
    stmt.run(
      data.account_name,
      data.account_number || null,
      data.bank_name,
      id
    );
    
    return this.findById(id);
  },

  upsert(data) {
    const existing = this.findByName(data.account_name);
    
    if (existing) {
      return this.update(existing.id, data);
    } else {
      return this.create(data);
    }
  },

  findOrCreate(data) {
    let account = this.findByName(data.account_name);
    
    if (!account) {
      account = this.create({
        account_name: data.account_name,
        account_number: data.account_number || null,
        bank_name: data.bank_name || '未知银行'
      });
    }
    
    return account;
  },

  delete(id) {
    return db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id);
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as count FROM accounts`).get().count;
  }
};

export default accountModel;
