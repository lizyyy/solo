import db from '../config/database.js';

export const holderModel = {
  findAll() {
    return db.prepare(`
      SELECT * FROM holders ORDER BY created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`
      SELECT * FROM holders WHERE id = ?
    `).get(id);
  },

  findByName(holderName) {
    return db.prepare(`
      SELECT * FROM holders WHERE holder_name = ?
    `).get(holderName);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO holders (holder_name)
      VALUES (?)
    `);
    
    const result = stmt.run(data.holder_name);
    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const stmt = db.prepare(`
      UPDATE holders SET
        holder_name = ?
      WHERE id = ?
    `);
    
    stmt.run(data.holder_name, id);
    return this.findById(id);
  },

  upsert(data) {
    const existing = this.findByName(data.holder_name);
    
    if (existing) {
      return this.update(existing.id, data);
    } else {
      return this.create(data);
    }
  },

  findOrCreate(data) {
    let holder = this.findByName(data.holder_name);
    
    if (!holder) {
      holder = this.create({
        holder_name: data.holder_name
      });
    }
    
    return holder;
  },

  delete(id) {
    return db.prepare(`DELETE FROM holders WHERE id = ?`).run(id);
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as count FROM holders`).get().count;
  }
};

export default holderModel;
