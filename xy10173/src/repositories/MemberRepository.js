const db = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class MemberRepository {
  create(name) {
    const now = dayjs().valueOf();
    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO members (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, now, now);
    return this.findById(id);
  }

  findById(id) {
    return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  }

  findAll() {
    return db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
  }
}

module.exports = new MemberRepository();
