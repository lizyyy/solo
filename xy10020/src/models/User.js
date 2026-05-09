const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database/client');

class User {
  static hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static create(user) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const passwordHash = this.hashPassword(user.password);

    const stmt = db.prepare(`
      INSERT INTO users (
        id, username, password_hash, role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      user.username,
      passwordHash,
      user.role || 'user',
      now,
      now
    );

    return this.findById(id);
  }

  static findById(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return this.deserialize(row);
  }

  static findByUsername(username) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE username = ?
    `);

    const row = stmt.get(username);
    if (!row) return null;

    return this.deserialize(row);
  }

  static verifyPassword(username, password) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE username = ?
    `);

    const row = stmt.get(username);
    if (!row) return null;

    const passwordHash = this.hashPassword(password);
    if (row.password_hash !== passwordHash) return null;

    return this.deserialize(row);
  }

  static updateRole(id, role) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE users
      SET role = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(role, now, id);
    return this.findById(id);
  }

  static deserialize(row) {
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = User;
