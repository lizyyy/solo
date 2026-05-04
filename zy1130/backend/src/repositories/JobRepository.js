const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../database');
const Job = require('../models/Job');

class JobRepository {
  async create(jobData) {
    const job = new Job(jobData);
    const now = new Date().toISOString();
    
    await runAsync(`
      INSERT INTO jobs (
        id, client_name, address, lat, lng, service_type,
        time_window_start, time_window_end, service_duration,
        priority, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      job.id, job.clientName, job.address, job.lat, job.lng, job.serviceType,
      job.timeWindowStart, job.timeWindowEnd, job.serviceDuration,
      job.priority, job.notes, job.status, now, now
    ]);
    
    return job;
  }

  async update(id, jobData) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`任务 ${id} 不存在`);
    }
    
    const updated = {
      ...existing.toJSON(),
      ...jobData,
      updatedAt: new Date().toISOString()
    };
    
    const job = new Job(updated);
    
    await runAsync(`
      UPDATE jobs SET
        client_name = ?, address = ?, lat = ?, lng = ?,
        service_type = ?, time_window_start = ?, time_window_end = ?,
        service_duration = ?, priority = ?, notes = ?, status = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      job.clientName, job.address, job.lat, job.lng,
      job.serviceType, job.timeWindowStart, job.timeWindowEnd,
      job.serviceDuration, job.priority, job.notes, job.status,
      job.updatedAt, id
    ]);
    
    return job;
  }

  async delete(id) {
    const result = await runAsync('DELETE FROM jobs WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const row = await getAsync('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!row) return null;
    return this.rowToModel(row);
  }

  async findAll(options = {}) {
    const { status, serviceType, limit, offset } = options;
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (serviceType) {
      sql += ' AND service_type = ?';
      params.push(serviceType);
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
    const { status, serviceType } = options;
    let sql = 'SELECT COUNT(*) as count FROM jobs WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (serviceType) {
      sql += ' AND service_type = ?';
      params.push(serviceType);
    }
    
    const result = await getAsync(sql, params);
    return result.count;
  }

  async batchCreate(jobsData) {
    const results = [];
    for (const jobData of jobsData) {
      const job = await this.create(jobData);
      results.push(job);
    }
    return results;
  }

  async deleteAll() {
    await runAsync('DELETE FROM jobs');
  }

  rowToModel(row) {
    return new Job({
      id: row.id,
      clientName: row.client_name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      serviceType: row.service_type,
      timeWindowStart: row.time_window_start,
      timeWindowEnd: row.time_window_end,
      serviceDuration: row.service_duration,
      priority: row.priority,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}

module.exports = new JobRepository();
