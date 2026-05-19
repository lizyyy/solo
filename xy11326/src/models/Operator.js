const { runQuery, getOne, getAll } = require('../database/connection');
const { encryptSensitiveFields, decryptSensitiveFields } = require('../utils/security');

class Operator {
  static async create(data) {
    const now = new Date().toISOString();
    const encryptedData = encryptSensitiveFields(data);
    
    const result = await runQuery(`
      INSERT INTO operators (name, phone, idCard, bankAccount, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      encryptedData.name,
      encryptedData.phone,
      encryptedData.idCard,
      encryptedData.bankAccount,
      data.status || 'active',
      now,
      now
    ]);
    
    return { id: result.id, ...data, createdAt: now, updatedAt: now };
  }

  static async findById(id) {
    const row = await getOne('SELECT * FROM operators WHERE id = ?', [id]);
    if (!row) return null;
    return decryptSensitiveFields(row);
  }

  static async findAll(status = null) {
    let sql = 'SELECT * FROM operators';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY createdAt DESC';
    const rows = await getAll(sql, params);
    return rows.map(row => decryptSensitiveFields(row));
  }

  static async findByName(name) {
    const row = await getOne('SELECT * FROM operators WHERE name = ?', [name]);
    if (!row) return null;
    return decryptSensitiveFields(row);
  }

  static async update(id, data) {
    const now = new Date().toISOString();
    const encryptedData = encryptSensitiveFields(data);
    
    const updates = [];
    const params = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); params.push(encryptedData.name); }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(encryptedData.phone); }
    if (data.idCard !== undefined) { updates.push('idCard = ?'); params.push(encryptedData.idCard); }
    if (data.bankAccount !== undefined) { updates.push('bankAccount = ?'); params.push(encryptedData.bankAccount); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    
    updates.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    
    await runQuery(`UPDATE operators SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = Operator;
