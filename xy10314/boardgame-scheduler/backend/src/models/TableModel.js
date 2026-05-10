const { run, get, all } = require('./database');
const { v4: uuidv4 } = require('uuid');

class TableModel {
  static async getAll() {
    return all('SELECT * FROM tables WHERE status = ? ORDER BY name', ['active']);
  }

  static async getById(id) {
    return get('SELECT * FROM tables WHERE id = ?', [id]);
  }

  static async create(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO tables (id, name, capacity, location, status) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.capacity, data.location || null, 'active']
    );
    return this.getById(id);
  }

  static async update(id, data) {
    await run(
      'UPDATE tables SET name = ?, capacity = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [data.name, data.capacity, data.location || null, id]
    );
    return this.getById(id);
  }

  static async delete(id) {
    await run('UPDATE tables SET status = ? WHERE id = ?', ['deleted', id]);
    return true;
  }
}

module.exports = TableModel;
