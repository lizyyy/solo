const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const programModel = {
  getAll: () => {
    return db.prepare('SELECT * FROM programs ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM programs WHERE id = ?').get(id);
  },

  create: (data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO programs (id, name, episode_number, title, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.name, data.episode_number, data.title, data.status || 'draft');
    return programModel.getById(id);
  },

  update: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.episode_number !== undefined) { fields.push('episode_number = ?'); values.push(data.episode_number); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    
    if (fields.length === 0) return programModel.getById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE programs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return programModel.getById(id);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM programs WHERE id = ?');
    return stmt.run(id);
  }
};

module.exports = programModel;
