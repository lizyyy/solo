const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class UserService {
  generateUserHandle() {
    return crypto.randomBytes(32);
  }

  createUser(username, displayName = null) {
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existing) {
      throw new Error('USER_EXISTS');
    }

    const id = uuidv4();
    const userHandle = this.generateUserHandle();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO users (id, username, display_name, user_handle, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, displayName || username, userHandle, now, now);

    return this.getUserById(id);
  }

  getUserById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? this._formatUser(row) : null;
  }

  getUserByUsername(username) {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row ? this._formatUser(row) : null;
  }

  getUserByUserHandle(userHandle) {
    const row = db.prepare('SELECT * FROM users WHERE user_handle = ?').get(userHandle);
    return row ? this._formatUser(row) : null;
  }

  getAllUsers() {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows.map(row => this._formatUser(row));
  }

  updateUser(id, { displayName }) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?
    `).run(displayName, now, id);

    if (result.changes === 0) {
      return null;
    }
    return this.getUserById(id);
  }

  deleteUser(id) {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  _formatUser(row) {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      userHandle: row.user_handle,
      userHandleBase64: row.user_handle.toString('base64url'),
      createdAt: new Date(row.created_at * 1000).toISOString(),
      updatedAt: new Date(row.updated_at * 1000).toISOString()
    };
  }
}

module.exports = new UserService();
