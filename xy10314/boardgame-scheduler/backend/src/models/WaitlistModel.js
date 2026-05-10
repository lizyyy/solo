const { run, get, all } = require('./database');
const { v4: uuidv4 } = require('uuid');

class WaitlistModel {
  static async getAll() {
    return all(`
      SELECT w.*, s.name as script_name
      FROM waitlist w
      LEFT JOIN scripts s ON w.script_id = s.id
      WHERE w.status = ?
      ORDER BY w.date, w.start_time, w.priority DESC, w.created_at
    `, ['waiting']);
  }

  static async getByDate(date) {
    return all(`
      SELECT w.*, s.name as script_name
      FROM waitlist w
      LEFT JOIN scripts s ON w.script_id = s.id
      WHERE w.date = ? AND w.status = ?
      ORDER BY w.priority DESC, w.created_at
    `, [date, 'waiting']);
  }

  static async getById(id) {
    return get(`
      SELECT w.*, s.name as script_name
      FROM waitlist w
      LEFT JOIN scripts s ON w.script_id = s.id
      WHERE w.id = ?
    `, [id]);
  }

  static async getByIdempotencyKey(key) {
    return get(`
      SELECT w.*, s.name as script_name
      FROM waitlist w
      LEFT JOIN scripts s ON w.script_id = s.id
      WHERE w.idempotency_key = ?
    `, [key]);
  }

  static async create(data, idempotencyKey) {
    const id = uuidv4();
    await run(`
      INSERT INTO waitlist (
        id, customer_name, customer_phone, script_id, date, start_time,
        player_count, priority, status, original_reservation_id, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.customer_name, data.customer_phone, data.script_id, data.date, data.start_time,
      data.player_count, data.priority || 0, 'waiting', data.original_reservation_id || null,
      idempotencyKey || null
    ]);
    return this.getById(id);
  }

  static async updateStatus(id, status) {
    await run('UPDATE waitlist SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    return this.getById(id);
  }

  static async delete(id) {
    await run('DELETE FROM waitlist WHERE id = ?', [id]);
    return true;
  }

  static async checkDuplicate(customerPhone, scriptId, date) {
    return get(`
      SELECT * FROM waitlist 
      WHERE customer_phone = ? AND script_id = ? AND date = ? AND status = 'waiting'
    `, [customerPhone, scriptId, date]);
  }
}

module.exports = WaitlistModel;
