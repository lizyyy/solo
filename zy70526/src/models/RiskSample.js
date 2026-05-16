const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'rejected', 'need_reprocess'];
const VALID_RISK_LEVELS = ['high', 'medium', 'low'];

class RiskSample {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { dataset_id, sample_data, risk_level, risk_type, identified_fields, confidence_score } = data;
      const identifiedFieldsJson = JSON.stringify(identified_fields || []);
      
      db.run(
        `INSERT INTO risk_samples (id, dataset_id, sample_data, risk_level, risk_type, identified_fields, confidence_score)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, dataset_id, sample_data, risk_level, risk_type, identifiedFieldsJson, confidence_score],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data, status: 'pending' });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM risk_samples WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.identified_fields = JSON.parse(row.identified_fields || '[]');
          resolve(row);
        } else resolve(null);
      });
    });
  }

  static findByDatasetId(dataset_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM risk_samples WHERE dataset_id = ? ORDER BY created_at DESC',
        [dataset_id],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => {
              row.identified_fields = JSON.parse(row.identified_fields || '[]');
            });
            resolve(rows);
          }
        }
      );
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      if (!VALID_STATUSES.includes(status)) {
        reject(new Error(`Invalid status: ${status}`));
        return;
      }
      
      db.run(
        'UPDATE risk_samples SET status = ? WHERE id = ?',
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM risk_samples WHERE 1=1';
      const params = [];
      
      if (filters.dataset_id) {
        query += ' AND dataset_id = ?';
        params.push(filters.dataset_id);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.risk_level) {
        query += ' AND risk_level = ?';
        params.push(filters.risk_level);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            row.identified_fields = JSON.parse(row.identified_fields || '[]');
          });
          resolve(rows);
        }
      });
    });
  }

  static getRiskLevels() {
    return VALID_RISK_LEVELS;
  }

  static getStatuses() {
    return VALID_STATUSES;
  }
}

module.exports = RiskSample;