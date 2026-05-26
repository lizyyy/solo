const db = require('../database/db');
const { generateRecordNo, formatDateTime } = require('../utils/generator');

class RecordService {
  async createRecord(data) {
    const record_no = generateRecordNo();
    const {
      batch_id, pole_no, light_no, record_type, alarm_type, alarm_level,
      location, description, maintenance_team, handler, report_time, source_data
    } = data;
    
    const result = await db.run(
      `INSERT INTO records 
       (record_no, batch_id, pole_no, light_no, record_type, alarm_type, alarm_level,
        location, description, maintenance_team, handler, report_time, source_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record_no, batch_id, pole_no, light_no, record_type, alarm_type, alarm_level,
        location, description, maintenance_team, handler, report_time, 
        source_data ? JSON.stringify(source_data) : null
      ]
    );
    
    return await this.getRecordById(result.id);
  }

  async getRecordById(id) {
    return await db.get('SELECT * FROM records WHERE id = ?', [id]);
  }

  async getRecordByNo(record_no) {
    return await db.get('SELECT * FROM records WHERE record_no = ?', [record_no]);
  }

  async updateRecordStatus(id, status, updated_at = formatDateTime()) {
    await db.run(
      'UPDATE records SET status = ?, updated_at = ? WHERE id = ?',
      [status, updated_at, id]
    );
  }

  async updateRecordRecheck(id, recheck_result, recheck_by, recheck_time = formatDateTime()) {
    await db.run(
      'UPDATE records SET recheck_result = ?, recheck_by = ?, recheck_time = ?, status = ?, updated_at = ? WHERE id = ?',
      [recheck_result, recheck_by, recheck_time, 'rechecked', recheck_time, id]
    );
  }

  async listRecords(params = {}) {
    let sql = 'SELECT * FROM records WHERE 1=1';
    const queryParams = [];
    
    if (params.pole_no) {
      sql += ' AND pole_no = ?';
      queryParams.push(params.pole_no);
    }
    if (params.maintenance_team) {
      sql += ' AND maintenance_team = ?';
      queryParams.push(params.maintenance_team);
    }
    if (params.recheck_result) {
      sql += ' AND recheck_result = ?';
      queryParams.push(params.recheck_result);
    }
    if (params.status) {
      sql += ' AND status = ?';
      queryParams.push(params.status);
    }
    if (params.batch_id) {
      sql += ' AND batch_id = ?';
      queryParams.push(params.batch_id);
    }
    if (params.record_type) {
      sql += ' AND record_type = ?';
      queryParams.push(params.record_type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (params.limit) {
      sql += ' LIMIT ?';
      queryParams.push(parseInt(params.limit));
    }
    if (params.offset) {
      sql += ' OFFSET ?';
      queryParams.push(parseInt(params.offset));
    }
    
    return await db.all(sql, queryParams);
  }

  async countRecords(params = {}) {
    let sql = 'SELECT COUNT(*) as total FROM records WHERE 1=1';
    const queryParams = [];
    
    if (params.pole_no) {
      sql += ' AND pole_no = ?';
      queryParams.push(params.pole_no);
    }
    if (params.maintenance_team) {
      sql += ' AND maintenance_team = ?';
      queryParams.push(params.maintenance_team);
    }
    if (params.recheck_result) {
      sql += ' AND recheck_result = ?';
      queryParams.push(params.recheck_result);
    }
    if (params.status) {
      sql += ' AND status = ?';
      queryParams.push(params.status);
    }
    if (params.batch_id) {
      sql += ' AND batch_id = ?';
      queryParams.push(params.batch_id);
    }
    if (params.record_type) {
      sql += ' AND record_type = ?';
      queryParams.push(params.record_type);
    }
    
    const result = await db.get(sql, queryParams);
    return result.total;
  }

  async getRecordsByPoleNo(pole_no) {
    return await db.all(
      'SELECT * FROM records WHERE pole_no = ? ORDER BY created_at DESC',
      [pole_no]
    );
  }
}

module.exports = new RecordService();
