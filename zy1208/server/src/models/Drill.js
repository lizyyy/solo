const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Drill {
  static create(name, description) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO drills (id, name, description, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    
    stmt.run(id, name, description || '', now, now);
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM drills WHERE id = ?');
    return stmt.get(id);
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM drills ORDER BY created_at DESC');
    return stmt.all();
  }

  static update(id, data) {
    const now = new Date().toISOString();
    const updates = ['updated_at = ?'];
    const values = [now];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE drills SET ${updates.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM drills WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

module.exports = Drill;
