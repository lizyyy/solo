const { runQuery, getQuery, allQuery } = require('../config/database');

class ReconciliationRecordDAO {
  async create(recordData) {
    const { reconciliation_id, complaint_id, bus_id, driver_id, reconciliation_date, checkin_time, gps_arrival_time, time_difference, status = 'pending', result, responsibility, notes, reviewed_by, reviewed_at } = recordData;
    await runQuery(
      `INSERT INTO reconciliation_records (reconciliation_id, complaint_id, bus_id, driver_id, reconciliation_date, checkin_time, gps_arrival_time, time_difference, status, result, responsibility, notes, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reconciliation_id, complaint_id, bus_id, driver_id, reconciliation_date, checkin_time, gps_arrival_time, time_difference, status, result, responsibility, notes, reviewed_by, reviewed_at]
    );
    return this.getById(reconciliation_id);
  }

  async getById(reconciliation_id) {
    return getQuery(`
      SELECT rr.*, pc.description as complaint_description, pc.complaint_type,
             d.name as driver_name, b.plate_number, s.name as student_name, s.parent_name
      FROM reconciliation_records rr
      LEFT JOIN parent_complaints pc ON rr.complaint_id = pc.complaint_id
      LEFT JOIN drivers d ON rr.driver_id = d.driver_id
      LEFT JOIN buses b ON rr.bus_id = b.bus_id
      LEFT JOIN students s ON pc.student_id = s.student_id
      WHERE rr.reconciliation_id = ?
    `, [reconciliation_id]);
  }

  async getByComplaintId(complaint_id) {
    return getQuery(`SELECT * FROM reconciliation_records WHERE complaint_id = ?`, [complaint_id]);
  }

  async getByDateRange(startDate, endDate) {
    return allQuery(`
      SELECT rr.*, pc.description as complaint_description, pc.complaint_type,
             d.name as driver_name, b.plate_number, s.name as student_name
      FROM reconciliation_records rr
      LEFT JOIN parent_complaints pc ON rr.complaint_id = pc.complaint_id
      LEFT JOIN drivers d ON rr.driver_id = d.driver_id
      LEFT JOIN buses b ON rr.bus_id = b.bus_id
      LEFT JOIN students s ON pc.student_id = s.student_id
      WHERE rr.reconciliation_date BETWEEN ? AND ?
      ORDER BY rr.reconciliation_date DESC
    `, [startDate, endDate]);
  }

  async getByStatus(status) {
    return allQuery(`
      SELECT rr.*, pc.description as complaint_description, pc.complaint_type,
             d.name as driver_name, b.plate_number, s.name as student_name
      FROM reconciliation_records rr
      LEFT JOIN parent_complaints pc ON rr.complaint_id = pc.complaint_id
      LEFT JOIN drivers d ON rr.driver_id = d.driver_id
      LEFT JOIN buses b ON rr.bus_id = b.bus_id
      LEFT JOIN students s ON pc.student_id = s.student_id
      WHERE rr.status = ?
      ORDER BY rr.created_at DESC
    `, [status]);
  }

  async getAll() {
    return allQuery(`
      SELECT rr.*, pc.description as complaint_description, pc.complaint_type,
             d.name as driver_name, b.plate_number, s.name as student_name
      FROM reconciliation_records rr
      LEFT JOIN parent_complaints pc ON rr.complaint_id = pc.complaint_id
      LEFT JOIN drivers d ON rr.driver_id = d.driver_id
      LEFT JOIN buses b ON rr.bus_id = b.bus_id
      LEFT JOIN students s ON pc.student_id = s.student_id
      ORDER BY rr.created_at DESC
    `);
  }

  async update(reconciliation_id, updateData) {
    const fields = [];
    const values = [];
    for (const key in updateData) {
      if (key !== 'reconciliation_id') {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(reconciliation_id);
    await runQuery(`UPDATE reconciliation_records SET ${fields.join(', ')} WHERE reconciliation_id = ?`, values);
    return this.getById(reconciliation_id);
  }

  async review(reconciliation_id, status, result, responsibility, notes, reviewed_by) {
    await runQuery(
      `UPDATE reconciliation_records 
       SET status = ?, result = ?, responsibility = ?, notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE reconciliation_id = ?`,
      [status, result, responsibility, notes, reviewed_by, reconciliation_id]
    );
    return this.getById(reconciliation_id);
  }
}

class ImportBatchDAO {
  async create(batchData) {
    const { batch_id, batch_type, file_name, total_records = 0, success_count = 0, failed_count = 0, status = 'processing', error_details, created_by } = batchData;
    await runQuery(
      `INSERT INTO import_batches (batch_id, batch_type, file_name, total_records, success_count, failed_count, status, error_details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, batch_type, file_name, total_records, success_count, failed_count, status, error_details, created_by]
    );
    return this.getById(batch_id);
  }

  async getById(batch_id) {
    return getQuery(`SELECT * FROM import_batches WHERE batch_id = ?`, [batch_id]);
  }

  async updateStatus(batch_id, status, success_count, failed_count, error_details = null) {
    await runQuery(
      `UPDATE import_batches SET status = ?, success_count = ?, failed_count = ?, error_details = ? WHERE batch_id = ?`,
      [status, success_count, failed_count, error_details, batch_id]
    );
    return this.getById(batch_id);
  }

  async getAll() {
    return allQuery(`SELECT * FROM import_batches ORDER BY created_at DESC`);
  }
}

class OperationLogDAO {
  async create(logData) {
    const { log_id, operator, operation_type, target_type, target_id, details, ip_address } = logData;
    await runQuery(
      `INSERT INTO operation_logs (log_id, operator, operation_type, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [log_id, operator, operation_type, target_type, target_id, details, ip_address]
    );
    return this.getById(log_id);
  }

  async getById(log_id) {
    return getQuery(`SELECT * FROM operation_logs WHERE log_id = ?`, [log_id]);
  }

  async getByOperationType(operation_type) {
    return allQuery(`SELECT * FROM operation_logs WHERE operation_type = ? ORDER BY created_at DESC`, [operation_type]);
  }

  async getAll(limit = 100) {
    return allQuery(`SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
  }
}

module.exports = {
  ReconciliationRecordDAO,
  ImportBatchDAO,
  OperationLogDAO
};