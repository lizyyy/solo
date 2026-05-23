const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class BlacklistService {
  async addToBlacklist(data) {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO blacklist (
        id, personnel_id, id_card, name, reason,
        status, added_by, expires_at, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      id,
      data.personnel_id || null,
      data.id_card || null,
      data.name || null,
      data.reason,
      data.status || 'active',
      data.added_by || null,
      data.expires_at || null,
      data.remarks || null
    );

    return this.getBlacklistById(id);
  }

  async getBlacklistById(id) {
    const stmt = db.prepare('SELECT * FROM blacklist WHERE id = ?');
    return await stmt.get(id);
  }

  async getBlacklist(filters = {}) {
    let sql = 'SELECT * FROM blacklist WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.id_card) {
      sql += ' AND id_card = ?';
      params.push(filters.id_card);
    }

    sql += ' ORDER BY added_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return await stmt.all(...params);
  }

  async updateBlacklistStatus(id, status, remarks = null) {
    const stmt = db.prepare(`
      UPDATE blacklist 
      SET status = ?, remarks = COALESCE(?, remarks)
      WHERE id = ?
    `);
    await stmt.run(status, remarks, id);
    return this.getBlacklistById(id);
  }

  async removeFromBlacklist(id, removedBy = null) {
    return this.updateBlacklistStatus(id, 'inactive', `移除操作人: ${removedBy}`);
  }
}

module.exports = new BlacklistService();
