const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const riskModel = {
  getAll: () => {
    return db.prepare('SELECT * FROM risks ORDER BY detected_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM risks WHERE id = ?').get(id);
  },

  getByProgramId: (programId) => {
    return db.prepare('SELECT * FROM risks WHERE program_id = ? ORDER BY detected_at DESC').all(programId);
  },

  getByStatus: (status) => {
    return db.prepare('SELECT * FROM risks WHERE status = ? ORDER BY detected_at DESC').all(status);
  },

  create: (data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO risks (
        id, program_id, material_id, authorization_id, 
        risk_type, description, severity, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.program_id,
      data.material_id,
      data.authorization_id,
      data.risk_type,
      data.description,
      data.severity || 'medium',
      data.status || 'pending'
    );
    return riskModel.getById(id);
  },

  update: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.risk_type !== undefined) { fields.push('risk_type = ?'); values.push(data.risk_type); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.severity !== undefined) { fields.push('severity = ?'); values.push(data.severity); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    
    if (fields.length === 0) return riskModel.getById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE risks SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return riskModel.getById(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM risks WHERE id = ?');
    return stmt.run(id);
  },

  getStats: () => {
    const result = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM risks
      GROUP BY status
    `).all();
    
    const stats = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    result.forEach(r => {
      stats[r.status] = r.count;
    });
    
    return stats;
  }
};

module.exports = riskModel;
