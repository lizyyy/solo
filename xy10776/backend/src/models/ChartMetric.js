const db = require('../database/db');

class ChartMetricModel {
  static async getMetrics(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM chart_metrics WHERE 1=1';
      const params = [];

      if (filters.chart_code) {
        sql += ' AND chart_code = ?';
        params.push(filters.chart_code);
      }
      if (filters.metric_name) {
        sql += ' AND metric_name = ?';
        params.push(filters.metric_name);
      }
      if (filters.start_date) {
        sql += ' AND metric_date >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND metric_date <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY metric_date DESC';

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getStatistics() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          chart_code,
          metric_name,
          COUNT(*) as data_points,
          AVG(metric_value) as avg_value,
          MAX(metric_value) as max_value,
          MIN(metric_value) as min_value,
          SUM(metric_value) as total_value
        FROM chart_metrics
        GROUP BY chart_code, metric_name
      `, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = ChartMetricModel;
