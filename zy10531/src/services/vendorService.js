const db = require('../models/database');

class VendorService {
  async createOrUpdate(vendorData) {
    const { vendor_code, ...fields } = vendorData;

    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM vendors WHERE vendor_code = ?`, [vendor_code], (err, existing) => {
        if (err) {
          reject(err);
          return;
        }

        if (existing) {
          const updateFields = Object.keys(fields)
            .map(key => `${key} = ?`)
            .join(', ');
          
          const values = [...Object.values(fields), new Date().toISOString(), vendor_code];

          db.run(
            `UPDATE vendors SET ${updateFields}, updated_at = ? WHERE vendor_code = ?`,
            values,
            function(err) {
              if (err) reject(err);
              else resolve({ ...existing, ...fields, updated_at: new Date().toISOString() });
            }
          );
        } else {
          const fieldNames = ['vendor_code', ...Object.keys(fields), 'raw_input'];
          const placeholders = fieldNames.map(() => '?').join(', ');
          const values = [vendor_code, ...Object.values(fields), JSON.stringify(vendorData)];

          db.run(
            `INSERT INTO vendors (${fieldNames.join(', ')}) VALUES (${placeholders})`,
            values,
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID, vendor_code, ...fields, status: 'pending' });
            }
          );
        }
      });
    });
  }

  async getByCode(vendorCode) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM vendors WHERE vendor_code = ?`, [vendorCode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAll(params = {}) {
    const { status, limit = 100, offset = 0 } = params;
    let query = `SELECT * FROM vendors`;
    let values = [];

    if (status) {
      query += ` WHERE status = ?`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    return new Promise((resolve, reject) => {
      db.all(query, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateStatus(vendorCode, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE vendors SET status = ?, updated_at = ? WHERE vendor_code = ?`,
        [status, new Date().toISOString(), vendorCode],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  async addCorrectionRecord(correction) {
    const { vendor_code, validation_id, field_name, old_value, new_value, corrected_by, correction_note } = correction;
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO correction_records (vendor_code, validation_id, field_name, old_value, new_value, corrected_by, correction_note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vendor_code, validation_id, field_name, old_value, new_value, corrected_by, correction_note],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  async getCorrectionHistory(vendorCode) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM correction_records WHERE vendor_code = ? ORDER BY created_at DESC`,
        [vendorCode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getValidationHistory(vendorCode) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM validation_records WHERE vendor_code = ? ORDER BY created_at DESC`,
        [vendorCode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = new VendorService();
