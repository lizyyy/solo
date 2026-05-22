const { getDb, runInTransaction } = require('./index');

class BatchDAO {
  static create(batchData) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO batches (batch_no, driver_name, driver_phone, submit_by, status, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      batchData.batch_no,
      batchData.driver_name,
      batchData.driver_phone,
      batchData.submit_by || 'system',
      batchData.status || 'pending',
      batchData.remark
    );
    return result.lastInsertRowid;
  }

  static findByBatchNo(batchNo) {
    const db = getDb();
    return db.prepare('SELECT * FROM batches WHERE batch_no = ?').get(batchNo);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
  }

  static updateStatus(id, status) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(status, id);
  }

  static freeze(id, frozenBy) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE batches SET frozen = 1, frozen_at = CURRENT_TIMESTAMP, frozen_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(frozenBy, id);
  }

  static unfreeze(id) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE batches SET frozen = 0, frozen_at = NULL, frozen_by = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM batches WHERE id = ?').run(id);
  }

  static list(limit = 100, offset = 0) {
    const db = getDb();
    return db.prepare('SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  }
}

class BoxDAO {
  static create(boxData) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO boxes (batch_id, box_no, original_box_no, wms_expected_qty, actual_qty, receive_time, receive_date, status, is_renamed, is_cross_day, compensation_amount, temperature_abnormal, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      boxData.batch_id,
      boxData.box_no,
      boxData.original_box_no || boxData.box_no,
      boxData.wms_expected_qty || 0,
      boxData.actual_qty || 0,
      boxData.receive_time,
      boxData.receive_date,
      boxData.status || 'normal',
      boxData.is_renamed ? 1 : 0,
      boxData.is_cross_day ? 1 : 0,
      boxData.compensation_amount || 0,
      boxData.temperature_abnormal ? 1 : 0,
      boxData.remark
    );
    return result.lastInsertRowid;
  }

  static findByBatchId(batchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM boxes WHERE batch_id = ?').all(batchId);
  }

  static findByBoxNoAndBatchId(batchId, boxNo) {
    const db = getDb();
    return db.prepare('SELECT * FROM boxes WHERE batch_id = ? AND box_no = ?').get(batchId, boxNo);
  }

  static update(id, updates) {
    const db = getDb();
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    const stmt = db.prepare(`UPDATE boxes SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    return stmt.run(...values);
  }

  static deleteByBatchId(batchId) {
    const db = getDb();
    return db.prepare('DELETE FROM boxes WHERE batch_id = ?').run(batchId);
  }
}

class TemperatureRecordDAO {
  static create(record) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO temperature_records (batch_id, box_no, record_time, temperature, humidity, is_abnormal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.batch_id,
      record.box_no,
      record.record_time,
      record.temperature,
      record.humidity || null,
      record.is_abnormal ? 1 : 0
    );
    return result.lastInsertRowid;
  }

  static findByBatchId(batchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM temperature_records WHERE batch_id = ? ORDER BY record_time').all(batchId);
  }

  static findByBatchIdAndBoxNo(batchId, boxNo) {
    const db = getDb();
    return db.prepare('SELECT * FROM temperature_records WHERE batch_id = ? AND box_no = ? ORDER BY record_time').all(batchId, boxNo);
  }

  static deleteByBatchId(batchId) {
    const db = getDb();
    return db.prepare('DELETE FROM temperature_records WHERE batch_id = ?').run(batchId);
  }
}

class PhotoDAO {
  static create(photo) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO photos (batch_id, photo_type, file_name, file_path, file_size, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      photo.batch_id,
      photo.photo_type,
      photo.file_name,
      photo.file_path,
      photo.file_size,
      photo.remark
    );
    return result.lastInsertRowid;
  }

  static findByBatchId(batchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM photos WHERE batch_id = ?').all(batchId);
  }

  static deleteByBatchId(batchId) {
    const db = getDb();
    return db.prepare('DELETE FROM photos WHERE batch_id = ?').run(batchId);
  }
}

class ReconciliationResultDAO {
  static create(result) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO reconciliation_results 
      (batch_id, total_boxes, normal_boxes, renamed_boxes, cross_day_boxes, temperature_abnormal_boxes, total_compensation, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = stmt.run(
      result.batch_id,
      result.total_boxes || 0,
      result.normal_boxes || 0,
      result.renamed_boxes || 0,
      result.cross_day_boxes || 0,
      result.temperature_abnormal_boxes || 0,
      result.total_compensation || 0,
      result.status || 'calculated'
    );
    return r.lastInsertRowid;
  }

  static findByBatchId(batchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM reconciliation_results WHERE batch_id = ?').get(batchId);
  }
}

class OperationHistoryDAO {
  static create(record) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO operation_history (batch_id, box_id, operation_type, operation_subtype, operator, before_data, after_data, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.batch_id || null,
      record.box_id || null,
      record.operation_type,
      record.operation_subtype || null,
      record.operator || 'system',
      record.before_data ? JSON.stringify(record.before_data) : null,
      record.after_data ? JSON.stringify(record.after_data) : null,
      record.remark || null
    );
    return result.lastInsertRowid;
  }

  static findByBatchId(batchId, limit = 100) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM operation_history 
      WHERE batch_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(batchId, limit);
    return rows.map(r => ({
      ...r,
      before_data: r.before_data ? JSON.parse(r.before_data) : null,
      after_data: r.after_data ? JSON.parse(r.after_data) : null
    }));
  }

  static listAll(limit = 200) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM operation_history 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
    return rows.map(r => ({
      ...r,
      before_data: r.before_data ? JSON.parse(r.before_data) : null,
      after_data: r.after_data ? JSON.parse(r.after_data) : null
    }));
  }
}

class ManualAdjustmentDAO {
  static create(adjustment) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO manual_adjustments (batch_id, box_id, adjust_type, field_name, old_value, new_value, reason, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      adjustment.batch_id || null,
      adjustment.box_id || null,
      adjustment.adjust_type,
      adjustment.field_name || null,
      adjustment.old_value || null,
      adjustment.new_value || null,
      adjustment.reason,
      adjustment.operator
    );
    return result.lastInsertRowid;
  }

  static findByBatchId(batchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM manual_adjustments WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
  }
}

module.exports = {
  BatchDAO,
  BoxDAO,
  TemperatureRecordDAO,
  PhotoDAO,
  ReconciliationResultDAO,
  OperationHistoryDAO,
  ManualAdjustmentDAO,
  runInTransaction
};
