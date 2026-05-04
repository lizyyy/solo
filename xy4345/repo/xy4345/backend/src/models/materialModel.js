const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const materialModel = {
  getAll: () => {
    return db.prepare('SELECT * FROM materials ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  },

  getByProgramId: (programId) => {
    return db.prepare('SELECT * FROM materials WHERE program_id = ? ORDER BY created_at DESC').all(programId);
  },

  create: (data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO materials (id, program_id, type, name, source, duration, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.program_id,
      data.type,
      data.name,
      data.source,
      data.duration,
      data.metadata ? JSON.stringify(data.metadata) : null
    );
    return materialModel.getById(id);
  },

  update: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.source !== undefined) { fields.push('source = ?'); values.push(data.source); }
    if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }
    
    if (fields.length === 0) return materialModel.getById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return materialModel.getById(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM materials WHERE id = ?');
    return stmt.run(id);
  },

  findDuplicates: () => {
    return db.prepare(`
      SELECT m.*, 
             COUNT(DISTINCT m2.program_id) as program_count,
             GROUP_CONCAT(DISTINCT m2.program_id) as program_ids
      FROM materials m
      JOIN materials m2 ON m.name = m2.name AND m.source = m2.source
      GROUP BY m.id
      HAVING program_count > 1
    `).all();
  }
};

module.exports = materialModel;
