const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const AnomalyService = require('./anomalyService');
const db = require('../config/database');

class ExportService {
  static async exportAnomaliesToCSV(filters = {}) {
    const anomalies = await AnomalyService.getAnomalies(filters);

    const fields = [
      'id',
      'anomaly_type',
      'severity',
      'route_id',
      'stop_id',
      'stop_name',
      'driver_id',
      'driver_name',
      'scheduled_time',
      'actual_time',
      'delay_minutes',
      'distance_from_stop',
      'description',
      'status',
      'handler',
      'responsibility',
      'handled_at',
      'created_at'
    ];

    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(anomalies);
      
      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filename = `anomalies_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
      const filepath = path.join(exportDir, filename);
      
      fs.writeFileSync(filepath, csv);

      return {
        success: true,
        filename,
        filepath,
        recordCount: anomalies.length,
        csv
      };
    } catch (err) {
      throw err;
    }
  }

  static async exportComplaintsToCSV(filters = {}) {
    const complaints = await new Promise((resolve, reject) => {
      let query = 'SELECT * FROM complaints WHERE 1=1';
      const params = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.route_id) {
        query += ' AND route_id = ?';
        params.push(filters.route_id);
      }
      if (filters.start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const fields = [
      'id',
      'complaint_id',
      'parent_name',
      'parent_phone',
      'student_name',
      'stop_id',
      'stop_name',
      'route_id',
      'complaint_type',
      'complaint_time',
      'description',
      'status',
      'handler',
      'handled_at',
      'created_at'
    ];

    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(complaints);
      
      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filename = `complaints_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
      const filepath = path.join(exportDir, filename);
      
      fs.writeFileSync(filepath, csv);

      return {
        success: true,
        filename,
        filepath,
        recordCount: complaints.length,
        csv
      };
    } catch (err) {
      throw err;
    }
  }

  static async getProcessingHistory(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM processing_history WHERE 1=1';
      const params = [];

      if (filters.processing_type) {
        query += ' AND processing_type = ?';
        params.push(filters.processing_type);
      }
      if (filters.start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async getImportErrors(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM import_errors WHERE 1=1';
      const params = [];

      if (filters.import_type) {
        query += ' AND import_type = ?';
        params.push(filters.import_type);
      }
      if (filters.resolved !== undefined) {
        query += ' AND resolved = ?';
        params.push(filters.resolved ? 1 : 0);
      }
      if (filters.start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            try {
              row.raw_data = JSON.parse(row.raw_data);
            } catch (e) {
            }
          });
          resolve(rows);
        }
      });
    });
  }
}

module.exports = ExportService;
