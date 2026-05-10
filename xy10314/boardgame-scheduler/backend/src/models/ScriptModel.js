const { run, get, all } = require('./database');
const { v4: uuidv4 } = require('uuid');

class ScriptModel {
  static async getAll() {
    return all('SELECT * FROM scripts WHERE status = ? ORDER BY name', ['active']);
  }

  static async getById(id) {
    return get('SELECT * FROM scripts WHERE id = ?', [id]);
  }

  static async create(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO scripts (id, name, duration_minutes, min_players, max_players, difficulty, price, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.duration_minutes, data.min_players, data.max_players,
       data.difficulty || 'medium', data.price, data.description || null, 'active']
    );
    return this.getById(id);
  }

  static async update(id, data) {
    await run(
      'UPDATE scripts SET name = ?, duration_minutes = ?, min_players = ?, max_players = ?, difficulty = ?, price = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [data.name, data.duration_minutes, data.min_players, data.max_players,
       data.difficulty || 'medium', data.price, data.description || null, id]
    );
    return this.getById(id);
  }

  static async delete(id) {
    await run('UPDATE scripts SET status = ? WHERE id = ?', ['deleted', id]);
    return true;
  }
}

module.exports = ScriptModel;
