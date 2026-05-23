const db = require('../config/database');

class QueryService {
  static async getBarcodes(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM sample_barcodes WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.barcode) {
        query += ' AND barcode LIKE ?';
        params.push(`%${filters.barcode}%`);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getSamplingRecords(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM sampling_records WHERE 1=1';
      const params = [];
      
      if (filters.barcode) {
        query += ' AND barcode = ?';
        params.push(filters.barcode);
      }
      if (filters.clinic_name) {
        query += ' AND clinic_name LIKE ?';
        params.push(`%${filters.clinic_name}%`);
      }
      if (filters.start_date) {
        query += ' AND sampling_time >= ?';
        params.push(filters.start_date);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getTransportBatches(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM transport_batches WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.batch_code) {
        query += ' AND batch_code LIKE ?';
        params.push(`%${filters.batch_code}%`);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getBatchSamples(batchId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT bs.*, sr.sampling_time, sr.sampler, sr.patient_name
         FROM batch_samples bs
         LEFT JOIN sampling_records sr ON bs.sampling_record_id = sr.id
         WHERE bs.batch_id = ?`,
        [batchId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  static async getTransferRecords(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT tr.*, sr.sampling_time, sr.sampler, sr.clinic_name,
               tb.batch_code, tb.transporter, rr.name as rejection_reason
        FROM transfer_records tr
        LEFT JOIN sampling_records sr ON tr.sampling_record_id = sr.id
        LEFT JOIN transport_batches tb ON tr.batch_id = tb.id
        LEFT JOIN rejection_reasons rr ON tr.rejection_reason_id = rr.id
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.status) {
        query += ' AND tr.status = ?';
        params.push(filters.status);
      }
      if (filters.barcode) {
        query += ' AND tr.barcode = ?';
        params.push(filters.barcode);
      }
      if (filters.is_amended) {
        query += ' AND tr.is_amended = ?';
        params.push(filters.is_amended === 'true' ? 1 : 0);
      }
      
      query += ' ORDER BY tr.created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getAmendmentRequests(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM amendment_requests WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY requested_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getExceptionLogs(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM exception_logs WHERE 1=1';
      const params = [];
      
      if (filters.resolved) {
        query += ' AND resolved = ?';
        params.push(filters.resolved === 'true' ? 1 : 0);
      }
      
      query += ' ORDER BY occurred_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getRejectionReasons() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rejection_reasons WHERE is_active = 1', (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getReceivingWindows() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM receiving_windows WHERE is_active = 1', (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = QueryService;
