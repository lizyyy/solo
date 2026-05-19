const db = require('../models/database');
const ruleService = require('./ruleService');

class CleaningService {
  async createRecord(data) {
    const {
      room_number,
      cleaner_name,
      checkin_date,
      checkout_date,
      start_time,
      end_time,
      photo_count = 0,
      photo_urls = '',
      rework_count = 0,
      is_reworked = 0,
      parent_record_id = null
    } = data;

    const tempRecord = {
      photo_count,
      start_time,
      end_time,
      rework_count,
      is_reworked
    };

    const validation = await ruleService.validateRecord(tempRecord);

    const result = await db.run(`
      INSERT INTO cleaning_records (
        room_number, cleaner_name, checkin_date, checkout_date,
        start_time, end_time, photo_count, photo_urls,
        status, exception_types, score, deduction_amount,
        rework_count, is_reworked, parent_record_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      room_number, cleaner_name, checkin_date, checkout_date,
      start_time, end_time, photo_count, photo_urls,
      validation.status, validation.exceptions, validation.score, validation.deductionAmount,
      rework_count, is_reworked, parent_record_id
    ]);

    await ruleService.addAuditLog(
      result.id,
      'create',
      cleaner_name,
      validation.reasons || '记录创建',
      { validation }
    );

    return await this.getRecordById(result.id);
  }

  async getRecordById(id) {
    const record = await db.get('SELECT * FROM cleaning_records WHERE id = ?', [id]);
    if (record) {
      record.audit_logs = await ruleService.getAuditLogs(id);
    }
    return record;
  }

  async getRecords(filters = {}) {
    let sql = 'SELECT * FROM cleaning_records WHERE 1=1';
    const params = [];

    if (filters.cleaner_name) {
      sql += ' AND cleaner_name LIKE ?';
      params.push(`%${filters.cleaner_name}%`);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.exception_type) {
      sql += ' AND exception_types LIKE ?';
      params.push(`%${filters.exception_type}%`);
    }

    if (filters.start_date) {
      sql += ' AND created_at >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    if (filters.room_number) {
      sql += ' AND room_number LIKE ?';
      params.push(`%${filters.room_number}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const records = await db.all(sql, params);

    const summary = await this.getSummary(filters);

    return {
      records,
      summary,
      total: records.length
    };
  }

  async getSummary(filters = {}) {
    let sql = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_count,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        AVG(score) as avg_score,
        SUM(deduction_amount) as total_deduction
      FROM cleaning_records
      WHERE 1=1
    `;
    const params = [];

    if (filters.cleaner_name) {
      sql += ' AND cleaner_name LIKE ?';
      params.push(`%${filters.cleaner_name}%`);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.start_date) {
      sql += ' AND created_at >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    const result = await db.get(sql, params);
    return result;
  }

  async updateRecord(id, data) {
    const record = await this.getRecordById(id);
    if (!record) throw new Error('记录不存在');

    const updateFields = [];
    const params = [];

    const fields = ['room_number', 'cleaner_name', 'checkin_date', 'checkout_date',
      'start_time', 'end_time', 'photo_count', 'photo_urls',
      'rework_count', 'is_reworked'];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(data[field]);
      }
    });

    const updatedData = { ...record, ...data };
    const validation = await ruleService.validateRecord(updatedData);

    updateFields.push('status = ?');
    params.push(validation.status);
    updateFields.push('exception_types = ?');
    params.push(validation.exceptions);
    updateFields.push('score = ?');
    params.push(validation.score);
    updateFields.push('deduction_amount = ?');
    params.push(validation.deductionAmount);
    updateFields.push('updated_at = datetime("now", "localtime")');

    params.push(id);

    await db.run(
      `UPDATE cleaning_records SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    await ruleService.addAuditLog(
      id,
      'update',
      data.auditor_name || 'system',
      validation.reasons || '记录更新',
      { validation, changes: data }
    );

    return await this.getRecordById(id);
  }

  async auditRecord(id, data) {
    const { auditor_name, audit_remark, status } = data;

    await db.run(`
      UPDATE cleaning_records
      SET auditor_name = ?, audit_remark = ?, audit_time = datetime("now", "localtime"),
          status = ?, updated_at = datetime("now", "localtime")
      WHERE id = ?
    `, [auditor_name, audit_remark, status || 'audited', id]);

    await ruleService.addAuditLog(
      id,
      'audit',
      auditor_name,
      audit_remark,
      { status }
    );

    return await this.getRecordById(id);
  }

  async createRework(parentId, data) {
    const parentRecord = await this.getRecordById(parentId);
    if (!parentRecord) throw new Error('原记录不存在');

    const reworkData = {
      ...data,
      parent_record_id: parentId,
      is_reworked: 1,
      rework_count: (parentRecord.rework_count || 0) + 1
    };

    const result = await this.createRecord(reworkData);

    await db.run(
      'UPDATE cleaning_records SET rework_count = rework_count + 1 WHERE id = ?',
      [parentId]
    );

    return result;
  }
}

module.exports = new CleaningService();
