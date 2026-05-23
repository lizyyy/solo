const db = require('../config/database');

const ReconciliationTask = {
  create: (task, callback) => {
    const sql = 'INSERT INTO reconciliation_tasks (task_id, name, status, created_at, completed_at, statistics) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sql, [task.task_id, task.name, task.status, task.created_at, task.completed_at, task.statistics ? JSON.stringify(task.statistics) : null], callback);
  },
  findById: (taskId, callback) => {
    db.get('SELECT * FROM reconciliation_tasks WHERE task_id = ?', [taskId], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM reconciliation_tasks ORDER BY created_at DESC', callback);
  },
  updateStatus: (taskId, status, callback) => {
    db.run('UPDATE reconciliation_tasks SET status = ? WHERE task_id = ?', [status, taskId], callback);
  }
};

module.exports = ReconciliationTask;
