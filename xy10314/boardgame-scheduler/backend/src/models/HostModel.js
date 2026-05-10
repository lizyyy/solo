const { run, get, all } = require('./database');
const { v4: uuidv4 } = require('uuid');

class HostModel {
  static async getAll() {
    return all('SELECT * FROM hosts WHERE status = ? ORDER BY name', ['active']);
  }

  static async getById(id) {
    return get('SELECT * FROM hosts WHERE id = ?', [id]);
  }

  static async create(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO hosts (id, name, phone, email, skills, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.name, data.phone || null, data.email || null, data.skills || null, 'active']
    );
    return this.getById(id);
  }

  static async update(id, data) {
    await run(
      'UPDATE hosts SET name = ?, phone = ?, email = ?, skills = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [data.name, data.phone || null, data.email || null, data.skills || null, id]
    );
    return this.getById(id);
  }

  static async delete(id) {
    await run('UPDATE hosts SET status = ? WHERE id = ?', ['deleted', id]);
    return true;
  }

  static async getLeaves(hostId) {
    return all('SELECT * FROM host_leave WHERE host_id = ? ORDER BY leave_date', [hostId]);
  }

  static async addLeave(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO host_leave (id, host_id, leave_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.host_id, data.leave_date, data.start_time, data.end_time, data.reason || null]
    );
    return get('SELECT * FROM host_leave WHERE id = ?', [id]);
  }

  static async isHostOnLeave(hostId, date, startTime, endTime) {
    const leaves = await all(
      'SELECT * FROM host_leave WHERE host_id = ? AND leave_date = ?',
      [hostId, date]
    );

    for (const leave of leaves) {
      if (this.timesOverlap(startTime, endTime, leave.start_time, leave.end_time)) {
        return true;
      }
    }
    return false;
  }

  static timesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && end1 > start2;
  }
}

module.exports = HostModel;
