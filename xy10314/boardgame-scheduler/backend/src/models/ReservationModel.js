const { run, get, all, db } = require('./database');
const { v4: uuidv4 } = require('uuid');

class ReservationModel {
  static async getByDate(date) {
    return all(`
      SELECT r.*, t.name as table_name, s.name as script_name, s.duration_minutes, h.name as host_name
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      LEFT JOIN scripts s ON r.script_id = s.id
      LEFT JOIN hosts h ON r.host_id = h.id
      WHERE r.date = ?
      ORDER BY r.start_time
    `, [date]);
  }

  static async getById(id) {
    return get(`
      SELECT r.*, t.name as table_name, s.name as script_name, s.duration_minutes, h.name as host_name
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      LEFT JOIN scripts s ON r.script_id = s.id
      LEFT JOIN hosts h ON r.host_id = h.id
      WHERE r.id = ?
    `, [id]);
  }

  static async getByIdempotencyKey(key) {
    return get(`
      SELECT r.*, t.name as table_name, s.name as script_name, s.duration_minutes, h.name as host_name
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      LEFT JOIN scripts s ON r.script_id = s.id
      LEFT JOIN hosts h ON r.host_id = h.id
      WHERE r.idempotency_key = ?
    `, [key]);
  }

  static async create(data, idempotencyKey) {
    const id = uuidv4();
    await run(`
      INSERT INTO reservations (
        id, customer_name, customer_phone, table_id, script_id, host_id,
        reservation_type, date, start_time, end_time, player_count,
        total_amount, deposit_amount, status, notes, waitlist_id, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.customer_name, data.customer_phone, data.table_id, data.script_id, data.host_id || null,
      data.reservation_type, data.date, data.start_time, data.end_time, data.player_count,
      data.total_amount, data.deposit_amount || 0, data.status || 'confirmed',
      data.notes || null, data.waitlist_id || null, idempotencyKey || null
    ]);
    return this.getById(id);
  }

  static async update(id, data) {
    await run(`
      UPDATE reservations 
      SET customer_name = ?, customer_phone = ?, table_id = ?, script_id = ?, host_id = ?,
          date = ?, start_time = ?, end_time = ?, player_count = ?,
          total_amount = ?, deposit_amount = ?, status = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.customer_name, data.customer_phone, data.table_id, data.script_id, data.host_id || null,
      data.date, data.start_time, data.end_time, data.player_count,
      data.total_amount, data.deposit_amount || 0, data.status, data.notes || null,
      id
    ]);
    return this.getById(id);
  }

  static async updateStatus(id, status) {
    await run('UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    return this.getById(id);
  }

  static async delete(id) {
    await run('DELETE FROM reservations WHERE id = ?', [id]);
    return true;
  }

  static async getTableConflicts(tableId, date, startTime, endTime, excludeId = null) {
    let query, params;
    if (excludeId) {
      query = `SELECT * FROM reservations WHERE table_id = ? AND date = ? AND status != 'cancelled' AND id != ?`;
      params = [tableId, date, excludeId];
    } else {
      query = `SELECT * FROM reservations WHERE table_id = ? AND date = ? AND status != 'cancelled'`;
      params = [tableId, date];
    }
    const reservations = await all(query, params);
    return reservations.filter(r => this.timesOverlap(startTime, endTime, r.start_time, r.end_time));
  }

  static async getHostConflicts(hostId, date, startTime, endTime, excludeId = null) {
    if (!hostId) return [];
    let query, params;
    if (excludeId) {
      query = `SELECT * FROM reservations WHERE host_id = ? AND date = ? AND status != 'cancelled' AND id != ?`;
      params = [hostId, date, excludeId];
    } else {
      query = `SELECT * FROM reservations WHERE host_id = ? AND date = ? AND status != 'cancelled'`;
      params = [hostId, date];
    }
    const reservations = await all(query, params);
    return reservations.filter(r => this.timesOverlap(startTime, endTime, r.start_time, r.end_time));
  }

  static async getRevenueStats(startDate, endDate) {
    return get(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN reservation_type = 'private' THEN 1 ELSE 0 END) as private_count,
        SUM(CASE WHEN reservation_type = 'shared' THEN 1 ELSE 0 END) as shared_count,
        SUM(total_amount) as total_revenue,
        SUM(deposit_amount) as total_deposits,
        AVG(total_amount) as avg_order_value
      FROM reservations 
      WHERE date >= ? AND date <= ? AND status != 'cancelled'
    `, [startDate, endDate]);
  }

  static async getDailySchedule(date) {
    return all(`
      SELECT 
        r.id, r.customer_name, r.customer_phone, r.reservation_type,
        r.date, r.start_time, r.end_time, r.player_count, r.total_amount, r.status, r.notes,
        t.name as table_name, t.capacity as table_capacity,
        s.name as script_name, s.duration_minutes as script_duration,
        h.name as host_name
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      LEFT JOIN scripts s ON r.script_id = s.id
      LEFT JOIN hosts h ON r.host_id = h.id
      WHERE r.date = ? AND r.status != 'cancelled'
      ORDER BY r.start_time, t.name
    `, [date]);
  }

  static timesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && end1 > start2;
  }

  static async addHistory(reservationId, action, oldValue = null, newValue = null, actor = 'system') {
    const id = uuidv4();
    await run(
      'INSERT INTO reservation_history (id, reservation_id, action, old_value, new_value, actor) VALUES (?, ?, ?, ?, ?, ?)',
      [id, reservationId, action, oldValue ? JSON.stringify(oldValue) : null, 
       newValue ? JSON.stringify(newValue) : null, actor]
    );
    return true;
  }

  static async getHistory(reservationId) {
    return all(
      'SELECT * FROM reservation_history WHERE reservation_id = ? ORDER BY created_at DESC',
      [reservationId]
    );
  }
}

module.exports = ReservationModel;
