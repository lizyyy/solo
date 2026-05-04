const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const authorizationModel = {
  getAll: () => {
    return db.prepare('SELECT * FROM authorizations ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM authorizations WHERE id = ?').get(id);
  },

  getByProgramId: (programId) => {
    return db.prepare('SELECT * FROM authorizations WHERE program_id = ? ORDER BY created_at DESC').all(programId);
  },

  create: (data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO authorizations (
        id, program_id, material_id, type, holder_name, 
        permission_type, valid_from, valid_until, status, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.program_id,
      data.material_id,
      data.type,
      data.holder_name,
      data.permission_type,
      data.valid_from,
      data.valid_until,
      data.status || 'active',
      data.notes
    );
    return authorizationModel.getById(id);
  },

  update: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.holder_name !== undefined) { fields.push('holder_name = ?'); values.push(data.holder_name); }
    if (data.permission_type !== undefined) { fields.push('permission_type = ?'); values.push(data.permission_type); }
    if (data.valid_from !== undefined) { fields.push('valid_from = ?'); values.push(data.valid_from); }
    if (data.valid_until !== undefined) { fields.push('valid_until = ?'); values.push(data.valid_until); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    
    if (fields.length === 0) return authorizationModel.getById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE authorizations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return authorizationModel.getById(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM authorizations WHERE id = ?');
    return stmt.run(id);
  },

  checkExpiring: () => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return db.prepare(`
      SELECT * FROM authorizations 
      WHERE status = 'active' 
        AND valid_until IS NOT NULL 
        AND valid_until <= ?
        AND valid_until >= ?
      ORDER BY valid_until ASC
    `).all(thirtyDaysLater, today);
  },

  checkExpired: () => {
    const today = new Date().toISOString().split('T')[0];
    
    return db.prepare(`
      SELECT * FROM authorizations 
      WHERE status = 'active' 
        AND valid_until IS NOT NULL 
        AND valid_until < ?
      ORDER BY valid_until ASC
    `).all(today);
  }
};

module.exports = authorizationModel;
