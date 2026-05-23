const db = require('../config/database');

const Report = {
  create: (report, callback) => {
    const sql = 'INSERT INTO reports (report_id, task_id, report_type, content, generated_at, file_path) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sql, [report.report_id, report.task_id, report.report_type, report.content ? JSON.stringify(report.content) : null, report.generated_at, report.file_path], callback);
  },
  findById: (id, callback) => {
    db.get('SELECT * FROM reports WHERE report_id = ?', [id], (err, row) => {
      if (err) return callback(err);
      if (row && row.content) row.content = JSON.parse(row.content);
      callback(null, row);
    });
  },
  findByTaskId: (taskId, callback) => {
    db.all('SELECT * FROM reports WHERE task_id = ? ORDER BY generated_at DESC', [taskId], (err, rows) => {
      if (err) return callback(err);
      rows.forEach(r => { if (r.content) r.content = JSON.parse(r.content); });
      callback(null, rows);
    });
  },
  findAll: (callback) => {
    db.all('SELECT * FROM reports ORDER BY generated_at DESC', (err, rows) => {
      if (err) return callback(err);
      rows.forEach(r => { if (r.content) r.content = JSON.parse(r.content); });
      callback(null, rows);
    });
  },
  delete: (id, callback) => {
    db.run('DELETE FROM reports WHERE report_id = ?', [id], callback);
  }
};

module.exports = Report;
