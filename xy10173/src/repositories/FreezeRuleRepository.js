const db = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class FreezeRuleRepository {
  create(data) {
    const now = dayjs().valueOf();
    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO freeze_rules 
      (id, code, name, release_type, release_days, auto_release, priority, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.code, data.name, data.releaseType, data.releaseDays,
      data.autoRelease ? 1 : 0,
      data.priority || 0, data.description, now, now
    );
    return this.findById(id);
  }

  findById(id) {
    return db.prepare('SELECT * FROM freeze_rules WHERE id = ?').get(id);
  }

  findByCode(code) {
    return db.prepare('SELECT * FROM freeze_rules WHERE code = ?').get(code);
  }

  findAll() {
    return db.prepare('SELECT * FROM freeze_rules ORDER BY priority DESC').all();
  }
}

module.exports = new FreezeRuleRepository();
