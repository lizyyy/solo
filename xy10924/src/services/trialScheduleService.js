const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class TrialScheduleService {
  async checkScheduleConflict(workerId, scheduledDate, startTime, endTime, excludeId = null) {
    let sql = `
      SELECT * FROM trial_schedules
      WHERE worker_id = ?
        AND scheduled_date = ?
        AND status != 'cancelled'
        AND (
          (start_time < ? AND end_time > ?)
          OR (start_time < ? AND end_time > ?)
          OR (start_time >= ? AND end_time <= ?)
        )
    `;
    const params = [workerId, scheduledDate, endTime, startTime, endTime, startTime, startTime, endTime];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const conflicts = await allAsync(sql, params);
    return conflicts.length > 0;
  }

  async createSchedule(data) {
    const id = uuidv4();
    
    try {
      const hasConflict = await this.checkScheduleConflict(
        data.worker_id,
        data.scheduled_date,
        data.start_time,
        data.end_time
      );

      if (hasConflict) {
        await processingRecordService.createRecord(
          'create_schedule',
          null,
          'trial_schedule',
          data,
          null,
          'failed',
          '该阿姨在该时间段已有排期',
          data.operator || 'system'
        );
        throw new Error('该阿姨在该时间段已有排期');
      }

      await runAsync(
        `INSERT INTO trial_schedules (id, customer_id, worker_id, scheduled_date, start_time, end_time, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.customer_id, data.worker_id, data.scheduled_date, data.start_time, data.end_time, 'pending', data.notes]
      );

      await processingRecordService.createRecord(
        'create_schedule',
        id,
        'trial_schedule',
        data,
        { success: true, scheduleId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getSchedule(id);
    } catch (error) {
      if (error.message !== '该阿姨在该时间段已有排期') {
        await processingRecordService.createRecord(
          'create_schedule',
          null,
          'trial_schedule',
          data,
          null,
          'failed',
          error.message,
          data.operator || 'system'
        );
      }
      throw error;
    }
  }

  async getSchedule(id) {
    const schedule = await getAsync('SELECT * FROM trial_schedules WHERE id = ?', [id]);
    return schedule;
  }

  async getScheduleWithDetails(id) {
    const schedule = await getAsync('SELECT * FROM trial_schedules WHERE id = ?', [id]);
    if (!schedule) return null;

    const customer = await getAsync('SELECT id, name, phone, address FROM customers WHERE id = ?', [schedule.customer_id]);
    const worker = await getAsync('SELECT id, name, phone, skills FROM workers WHERE id = ?', [schedule.worker_id]);
    if (worker && worker.skills) worker.skills = JSON.parse(worker.skills);

    const deposits = await allAsync('SELECT * FROM deposit_transactions WHERE trial_schedule_id = ? ORDER BY created_at', [id]);
    const evaluations = await allAsync('SELECT * FROM evaluations WHERE trial_schedule_id = ? ORDER BY created_at', [id]);
    const conclusion = await getAsync('SELECT * FROM conversion_conclusions WHERE trial_schedule_id = ? ORDER BY created_at DESC LIMIT 1', [id]);
    const processingRecords = await processingRecordService.getRecordsByReference(id, 'trial_schedule');

    return {
      ...schedule,
      customer,
      worker,
      deposits,
      evaluations,
      conclusion,
      processing_records: processingRecords
    };
  }

  async getAllSchedules(filters = {}) {
    let sql = 'SELECT * FROM trial_schedules WHERE 1=1';
    const params = [];

    if (filters.customer_id) {
      sql += ' AND customer_id = ?';
      params.push(filters.customer_id);
    }
    if (filters.worker_id) {
      sql += ' AND worker_id = ?';
      params.push(filters.worker_id);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.scheduled_date) {
      sql += ' AND scheduled_date = ?';
      params.push(filters.scheduled_date);
    }

    sql += ' ORDER BY scheduled_date DESC, start_time DESC';

    return await allAsync(sql, params);
  }

  async updateScheduleStatus(id, status, data = {}) {
    try {
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的状态值');
      }

      await runAsync(
        'UPDATE trial_schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );

      await processingRecordService.createRecord(
        'update_schedule_status',
        id,
        'trial_schedule',
        { status, ...data },
        { success: true, newStatus: status },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getSchedule(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'update_schedule_status',
        id,
        'trial_schedule',
        { status, ...data },
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async manualCorrect(id, data, operator = 'system') {
    try {
      const fields = [];
      const values = [];

      if (data.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(data.customer_id); }
      if (data.worker_id !== undefined) { fields.push('worker_id = ?'); values.push(data.worker_id); }
      if (data.scheduled_date !== undefined) { fields.push('scheduled_date = ?'); values.push(data.scheduled_date); }
      if (data.start_time !== undefined) { fields.push('start_time = ?'); values.push(data.start_time); }
      if (data.end_time !== undefined) { fields.push('end_time = ?'); values.push(data.end_time); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await runAsync(
        `UPDATE trial_schedules SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await processingRecordService.createRecord(
        'manual_correct_schedule',
        id,
        'trial_schedule',
        data,
        { success: true },
        'success',
        null,
        operator
      );

      return await this.getSchedule(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'manual_correct_schedule',
        id,
        'trial_schedule',
        data,
        null,
        'failed',
        error.message,
        operator
      );
      throw error;
    }
  }
}

module.exports = new TrialScheduleService();
