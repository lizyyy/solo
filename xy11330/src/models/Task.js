const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Task {
  static async create(appointmentId, createdBy = 'system') {
    return new Promise((resolve, reject) => {
      const taskNo = `T${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
      
      db.run(
        `INSERT INTO tasks (task_no, appointment_id, created_by, status)
         VALUES (?, ?, ?, 'pending')`,
        [taskNo, appointmentId, createdBy],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, task_no: taskNo });
        }
      );
    });
  }

  static async assign(taskId, escortId, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        
        const oldStatus = row.status;
        
        db.run(
          `UPDATE tasks 
           SET escort_id = ?, status = 'assigned', assigned_at = ?, updated_at = ?
           WHERE id = ?`,
          [escortId, moment().format(), moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, old_status, new_status, operator)
               VALUES (?, 'assign', ?, 'assigned', ?)`,
              [taskId, oldStatus, operator],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes });
              }
            );
          }
        );
      });
    });
  }

  static async accept(taskId, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status, assigned_at FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        if (row.status !== 'assigned') return reject(new Error('任务状态不正确，当前状态: ' + row.status));
        
        const oldStatus = row.status;
        const waitingTime = row.assigned_at ? 
          moment().diff(moment(row.assigned_at), 'minutes') : 0;
        
        db.run(
          `UPDATE tasks 
           SET status = 'accepted', accepted_at = ?, waiting_time = ?, updated_at = ?
           WHERE id = ?`,
          [moment().format(), waitingTime, moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, old_status, new_status, operator)
               VALUES (?, 'accept', ?, 'accepted', ?)`,
              [taskId, oldStatus, operator],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes, waiting_time: waitingTime });
              }
            );
          }
        );
      });
    });
  }

  static async start(taskId, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status, accepted_at, appointment_id FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        if (row.status !== 'accepted') return reject(new Error('任务状态不正确，当前状态: ' + row.status));
        
        const oldStatus = row.status;
        
        db.run(
          `UPDATE tasks 
           SET status = 'in_progress', started_at = ?, updated_at = ?
           WHERE id = ?`,
          [moment().format(), moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, old_status, new_status, operator)
               VALUES (?, 'start', ?, 'in_progress', ?)`,
              [taskId, oldStatus, operator],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes });
              }
            );
          }
        );
      });
    });
  }

  static async complete(taskId, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status, started_at FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        if (row.status !== 'in_progress') return reject(new Error('任务状态不正确，当前状态: ' + row.status));
        
        const oldStatus = row.status;
        const actualDuration = row.started_at ? 
          moment().diff(moment(row.started_at), 'minutes') : null;
        
        db.run(
          `UPDATE tasks 
           SET status = 'completed', completed_at = ?, actual_duration = ?, updated_at = ?
           WHERE id = ?`,
          [moment().format(), actualDuration, moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, old_status, new_status, operator)
               VALUES (?, 'complete', ?, 'completed', ?)`,
              [taskId, oldStatus, operator],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes, actual_duration: actualDuration });
              }
            );
          }
        );
      });
    });
  }

  static async cancel(taskId, reason, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        if (['completed', 'cancelled'].includes(row.status)) {
          return reject(new Error('已完成或已取消的任务不能取消'));
        }
        
        const oldStatus = row.status;
        
        db.run(
          `UPDATE tasks 
           SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
           WHERE id = ?`,
          [moment().format(), reason, moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, old_status, new_status, operator, reason)
               VALUES (?, 'cancel', ?, 'cancelled', ?, ?)`,
              [taskId, oldStatus, operator, reason],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes });
              }
            );
          }
        );
      });
    });
  }

  static async insert(taskId, insertedBy = 'system') {
    return new Promise((resolve, reject) => {
      db.get('SELECT status, is_inserted FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('任务不存在'));
        if (row.is_inserted) return reject(new Error('该任务已是插队任务'));
        
        db.run(
          `UPDATE tasks 
           SET is_inserted = 1, inserted_by = ?, inserted_at = ?, updated_at = ?
           WHERE id = ?`,
          [insertedBy, moment().format(), moment().format(), taskId],
          function(err) {
            if (err) return reject(err);
            
            db.run(
              `INSERT INTO task_logs (task_id, action, operator, reason)
               VALUES (?, 'insert', ?, '插队处理')`,
              [taskId, insertedBy],
              (logErr) => {
                if (logErr) console.error('记录日志失败:', logErr);
                resolve({ success: true, changes: this.changes });
              }
            );
          }
        );
      });
    });
  }

  static async checkOverdue(taskId, overdueMinutes = 30, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT t.status, t.assigned_at, a.appointment_date, a.appointment_time
         FROM tasks t
         JOIN appointments a ON t.appointment_id = a.id
         WHERE t.id = ?`,
        [taskId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject(new Error('任务不存在'));
          
          if (['completed', 'cancelled'].includes(row.status)) {
            return resolve({ is_overdue: false });
          }
          
          let isOverdue = false;
          let reason = '';
          
          if (row.assigned_at) {
            const assignedTime = moment(row.assigned_at);
            const diffMinutes = moment().diff(assignedTime, 'minutes');
            if (diffMinutes > overdueMinutes && row.status === 'assigned') {
              isOverdue = true;
              reason = `接单超时：派单后${diffMinutes}分钟未接单`;
            }
          }
          
          if (row.appointment_date && row.appointment_time) {
            const appointmentTime = moment(`${row.appointment_date} ${row.appointment_time}`);
            const diffMinutes = moment().diff(appointmentTime, 'minutes');
            if (diffMinutes > 60 && ['pending', 'assigned'].includes(row.status)) {
              isOverdue = true;
              reason = `预约超时：已超过预约时间${diffMinutes}分钟`;
            }
          }
          
          if (isOverdue) {
            db.run(
              `UPDATE tasks SET is_overdue = 1, overdue_reason = ?, updated_at = ? WHERE id = ?`,
              [reason, moment().format(), taskId],
              function(err) {
                if (err) return reject(err);
                resolve({ is_overdue: true, reason, changes: this.changes });
              }
            );
          } else {
            resolve({ is_overdue: false });
          }
        }
      );
    });
  }

  static async findById(taskId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT t.*, e.name as escort_name, e.employee_id, 
                a.patient_name, a.patient_id, a.department, a.exam_type,
                a.appointment_date, a.appointment_time
         FROM tasks t
         LEFT JOIN escorts e ON t.escort_id = e.id
         JOIN appointments a ON t.appointment_id = a.id
         WHERE t.id = ?`,
        [taskId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT t.*, e.name as escort_name, e.employee_id, 
               a.patient_name, a.patient_id, a.department, a.exam_type,
               a.appointment_date, a.appointment_time
        FROM tasks t
        LEFT JOIN escorts e ON t.escort_id = e.id
        JOIN appointments a ON t.appointment_id = a.id
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.escort_id) {
        query += ' AND t.escort_id = ?';
        params.push(filters.escort_id);
      }
      
      if (filters.status) {
        query += ' AND t.status = ?';
        params.push(filters.status);
      }
      
      if (filters.start_date) {
        query += ' AND DATE(t.created_at) >= ?';
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        query += ' AND DATE(t.created_at) <= ?';
        params.push(filters.end_date);
      }
      
      if (filters.is_overdue !== undefined) {
        query += ' AND t.is_overdue = ?';
        params.push(filters.is_overdue ? 1 : 0);
      }
      
      if (filters.is_inserted !== undefined) {
        query += ' AND t.is_inserted = ?';
        params.push(filters.is_inserted ? 1 : 0);
      }
      
      query += ' ORDER BY t.created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getLogs(taskId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at DESC',
        [taskId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = Task;
