const { runAsync, getAsync, allAsync } = require('../utils/db');
const moment = require('moment');

class TrackingRecordModel {
  static generateRecordNo() {
    return 'REC-' + moment().format('YYYYMMDDHHmmss') + '-' + Math.floor(Math.random() * 1000);
  }

  static async create(recordData) {
    const recordNo = recordData.record_no || this.generateRecordNo();
    const sql = `INSERT INTO tracking_records 
      (record_no, batch_id, bed_no, patient_id, order_id, transfer_id, 
       ward, department, record_type, status, reason, handler, remarks) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await runAsync(sql, [
      recordNo, recordData.batch_id || null, recordData.bed_no || null,
      recordData.patient_id || null, recordData.order_id || null,
      recordData.transfer_id || null, recordData.ward || null,
      recordData.department || null, recordData.record_type,
      recordData.status, recordData.reason || null,
      recordData.handler, recordData.remarks || null
    ]);
    return { recordNo, id: result.lastID };
  }

  static async findByRecordNo(recordNo) {
    return getAsync('SELECT * FROM tracking_records WHERE record_no = ?', [recordNo]);
  }

  static async findByBatchId(batchId) {
    return allAsync('SELECT * FROM tracking_records WHERE batch_id = ? ORDER BY handled_at DESC', [batchId]);
  }

  static async findByBedNo(bedNo) {
    return allAsync('SELECT * FROM tracking_records WHERE bed_no = ? ORDER BY handled_at DESC', [bedNo]);
  }

  static async findByPatientId(patientId) {
    return allAsync('SELECT * FROM tracking_records WHERE patient_id = ? ORDER BY handled_at DESC', [patientId]);
  }

  static async findByWard(ward) {
    return allAsync('SELECT * FROM tracking_records WHERE ward = ? ORDER BY handled_at DESC', [ward]);
  }

  static async findByDepartment(department) {
    return allAsync('SELECT * FROM tracking_records WHERE department = ? ORDER BY handled_at DESC', [department]);
  }

  static async findByStatus(status) {
    return allAsync('SELECT * FROM tracking_records WHERE status = ? ORDER BY handled_at DESC', [status]);
  }

  static async findByRecordType(recordType) {
    return allAsync('SELECT * FROM tracking_records WHERE record_type = ? ORDER BY handled_at DESC', [recordType]);
  }

  static async updateStatus(recordIdentifier, status, reason, handler, remarks = null) {
    const isRecordNo = String(recordIdentifier).startsWith('REC-');
    
    const sql = `UPDATE tracking_records 
      SET status = ?, reason = ?, handler = ?, remarks = ?, handled_at = CURRENT_TIMESTAMP 
      WHERE ${isRecordNo ? 'record_no = ?' : 'id = ?'}`;
    return runAsync(sql, [status, reason, handler, remarks, recordIdentifier]);
  }

  static async getHistory(filters = {}) {
    let sql = `SELECT tr.*, b.batch_no, p.name as patient_name 
      FROM tracking_records tr 
      LEFT JOIN batches b ON tr.batch_id = b.id 
      LEFT JOIN patients p ON tr.patient_id = p.patient_id 
      WHERE 1=1`;
    const params = [];

    if (filters.ward) {
      sql += ' AND tr.ward = ?';
      params.push(filters.ward);
    }
    if (filters.department) {
      sql += ' AND tr.department = ?';
      params.push(filters.department);
    }
    if (filters.status) {
      sql += ' AND tr.status = ?';
      params.push(filters.status);
    }
    if (filters.record_type) {
      sql += ' AND tr.record_type = ?';
      params.push(filters.record_type);
    }
    if (filters.handler) {
      sql += ' AND tr.handler = ?';
      params.push(filters.handler);
    }

    sql += ' ORDER BY tr.handled_at DESC';
    return allAsync(sql, params);
  }

  static async getFullRecord(recordIdentifier) {
    const isRecordNo = String(recordIdentifier).startsWith('REC-');
    
    const sql = `
      SELECT 
        tr.*,
        b.batch_no,
        b.batch_type,
        p.name as patient_name,
        p.gender,
        p.age,
        p.diagnosis,
        pt.transfer_type,
        pt.transfer_time,
        co.order_id as cleaning_order_no,
        co.assigned_to as cleaner_name,
        co.status as cleaning_status,
        co.is_timeout as cleaning_timeout
      FROM tracking_records tr
      LEFT JOIN batches b ON tr.batch_id = b.id
      LEFT JOIN patients p ON tr.patient_id = p.patient_id
      LEFT JOIN patient_transfers pt ON tr.transfer_id = pt.transfer_id
      LEFT JOIN cleaning_orders co ON tr.order_id = co.order_id
      WHERE ${isRecordNo ? 'tr.record_no = ?' : 'tr.id = ?'}
    `;
    return getAsync(sql, [recordIdentifier]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM tracking_records ORDER BY handled_at DESC');
  }
}

module.exports = TrackingRecordModel;
