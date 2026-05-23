const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class ManualCorrectionService {
  createCorrection(correctionData) {
    const id = uuidv4();

    const originalStmt = db.prepare(`
      SELECT * FROM ${correctionData.target_table} 
      WHERE id = ?
    `);
    const originalRecord = originalStmt.get(correctionData.target_record_id);

    const stmt = db.prepare(`
      INSERT INTO manual_corrections (
        id, correction_type, target_record_id, target_table,
        original_value, corrected_value, reason, corrected_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      correctionData.correction_type,
      correctionData.target_record_id,
      correctionData.target_table,
      JSON.stringify(originalRecord),
      JSON.stringify(correctionData.corrected_value),
      correctionData.reason,
      correctionData.corrected_by
    );

    this.applyCorrection(
      correctionData.target_table,
      correctionData.target_record_id,
      correctionData.corrected_value
    );

    return this.getCorrectionById(id);
  }

  applyCorrection(tableName, recordId, correctedValue) {
    const tablesWithUpdatedAt = ['personnel', 'training_status', 'visitor_applications'];
    const tablesWithoutUpdatedAt = ['gate_events', 'blacklist', 'access_reports', 'exception_logs'];
    const allowedTables = [...tablesWithUpdatedAt, ...tablesWithoutUpdatedAt];
    
    if (!allowedTables.includes(tableName)) {
      throw new Error('不允许修改此表');
    }

    const fields = Object.keys(correctedValue).filter(k => k !== 'id');
    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => correctedValue[f]);
    values.push(recordId);

    let sql = `UPDATE ${tableName} SET ${setClauses}`;
    if (tablesWithUpdatedAt.includes(tableName)) {
      sql += ', updated_at = CURRENT_TIMESTAMP';
    }
    sql += ' WHERE id = ?';
    
    const stmt = db.prepare(sql);
    stmt.run(...values);
  }

  getCorrectionById(id) {
    const stmt = db.prepare('SELECT * FROM manual_corrections WHERE id = ?');
    return stmt.get(id);
  }

  getCorrectionsByRecord(targetTable, targetRecordId) {
    const stmt = db.prepare(`
      SELECT * FROM manual_corrections 
      WHERE target_table = ? AND target_record_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(targetTable, targetRecordId);
  }

  getCorrections(filters = {}) {
    let sql = 'SELECT * FROM manual_corrections WHERE 1=1';
    const params = [];

    if (filters.correction_type) {
      sql += ' AND correction_type = ?';
      params.push(filters.correction_type);
    }

    if (filters.target_table) {
      sql += ' AND target_table = ?';
      params.push(filters.target_table);
    }

    if (filters.corrected_by) {
      sql += ' AND corrected_by = ?';
      params.push(filters.corrected_by);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
}

module.exports = new ManualCorrectionService();
