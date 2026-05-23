const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class WorkerService {
  async createWorker(data) {
    const id = uuidv4();
    
    try {
      const skillsJson = data.skills ? JSON.stringify(data.skills) : null;

      await runAsync(
        `INSERT INTO workers (id, name, phone, id_card, age, skills, experience_years, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.phone, data.id_card, data.age, skillsJson, data.experience_years, data.status || 'available']
      );

      await processingRecordService.createRecord(
        'create_worker',
        id,
        'worker',
        data,
        { success: true, workerId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getWorker(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'create_worker',
        null,
        'worker',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getWorker(id) {
    const worker = await getAsync('SELECT * FROM workers WHERE id = ?', [id]);
    if (worker && worker.skills) {
      worker.skills = JSON.parse(worker.skills);
    }
    return worker;
  }

  async getAllWorkers(filters = {}) {
    let sql = 'SELECT * FROM workers WHERE 1=1';
    const params = [];

    if (filters.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${filters.name}%`);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    const workers = await allAsync(sql, params);
    return workers.map(w => {
      if (w.skills) w.skills = JSON.parse(w.skills);
      return w;
    });
  }

  async updateWorker(id, data) {
    try {
      const fields = [];
      const values = [];

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.id_card !== undefined) { fields.push('id_card = ?'); values.push(data.id_card); }
      if (data.age !== undefined) { fields.push('age = ?'); values.push(data.age); }
      if (data.skills !== undefined) { 
        fields.push('skills = ?'); 
        values.push(JSON.stringify(data.skills)); 
      }
      if (data.experience_years !== undefined) { fields.push('experience_years = ?'); values.push(data.experience_years); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await runAsync(
        `UPDATE workers SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await processingRecordService.createRecord(
        'update_worker',
        id,
        'worker',
        data,
        { success: true },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getWorker(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'update_worker',
        id,
        'worker',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getAvailableWorkers(date, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    
    const workers = await allAsync(
      `SELECT w.* FROM workers w
       WHERE w.status = 'available'
       AND w.id NOT IN (
         SELECT worker_id FROM trial_schedules
         WHERE scheduled_date = ? AND status != 'cancelled'
       )
       ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
      [date, pageSize, offset]
    );

    return workers.map(w => {
      if (w.skills) w.skills = JSON.parse(w.skills);
      return w;
    });
  }
}

module.exports = new WorkerService();
