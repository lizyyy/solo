const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../database');
const Worker = require('../models/Worker');

class WorkerRepository {
  async create(workerData) {
    const worker = new Worker(workerData);
    const now = new Date().toISOString();
    
    await runAsync(`
      INSERT INTO workers (
        id, name, phone, skills,
        start_location_lat, start_location_lng,
        end_location_lat, end_location_lng,
        work_start_time, work_end_time,
        lunch_start, lunch_end,
        max_jobs_per_day, vehicle_type,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      worker.id, worker.name, worker.phone, worker.skills.join(','),
      worker.startLocation.lat, worker.startLocation.lng,
      worker.endLocation.lat, worker.endLocation.lng,
      worker.workStartTime, worker.workEndTime,
      worker.lunchStart, worker.lunchEnd,
      worker.maxJobsPerDay, worker.vehicleType,
      worker.status, now, now
    ]);
    
    return worker;
  }

  async update(id, workerData) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`师傅 ${id} 不存在`);
    }
    
    const updated = {
      ...existing.toJSON(),
      ...workerData,
      updatedAt: new Date().toISOString()
    };
    
    const worker = new Worker(updated);
    
    await runAsync(`
      UPDATE workers SET
        name = ?, phone = ?, skills = ?,
        start_location_lat = ?, start_location_lng = ?,
        end_location_lat = ?, end_location_lng = ?,
        work_start_time = ?, work_end_time = ?,
        lunch_start = ?, lunch_end = ?,
        max_jobs_per_day = ?, vehicle_type = ?,
        status = ?, updated_at = ?
      WHERE id = ?
    `, [
      worker.name, worker.phone, worker.skills.join(','),
      worker.startLocation.lat, worker.startLocation.lng,
      worker.endLocation.lat, worker.endLocation.lng,
      worker.workStartTime, worker.workEndTime,
      worker.lunchStart, worker.lunchEnd,
      worker.maxJobsPerDay, worker.vehicleType,
      worker.status, worker.updatedAt, id
    ]);
    
    return worker;
  }

  async delete(id) {
    const result = await runAsync('DELETE FROM workers WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const row = await getAsync('SELECT * FROM workers WHERE id = ?', [id]);
    if (!row) return null;
    return this.rowToModel(row);
  }

  async findAll(options = {}) {
    const { status, limit, offset } = options;
    let sql = 'SELECT * FROM workers WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    if (offset) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
    
    const rows = await allAsync(sql, params);
    return rows.map(row => this.rowToModel(row));
  }

  async count(options = {}) {
    const { status } = options;
    let sql = 'SELECT COUNT(*) as count FROM workers WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    const result = await getAsync(sql, params);
    return result.count;
  }

  async batchCreate(workersData) {
    const results = [];
    for (const workerData of workersData) {
      const worker = await this.create(workerData);
      results.push(worker);
    }
    return results;
  }

  async deleteAll() {
    await runAsync('DELETE FROM workers');
  }

  rowToModel(row) {
    return new Worker({
      id: row.id,
      name: row.name,
      phone: row.phone,
      skills: row.skills,
      startLocation: {
        lat: row.start_location_lat,
        lng: row.start_location_lng
      },
      endLocation: {
        lat: row.end_location_lat,
        lng: row.end_location_lng
      },
      workStartTime: row.work_start_time,
      workEndTime: row.work_end_time,
      lunchStart: row.lunch_start,
      lunchEnd: row.lunch_end,
      maxJobsPerDay: row.max_jobs_per_day,
      vehicleType: row.vehicle_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = new WorkerRepository();
