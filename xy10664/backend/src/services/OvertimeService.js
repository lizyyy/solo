const db = require('../models/database');
const LogService = require('./LogService');

class OvertimeService {
  static validateOvertime(overtime) {
    const { employee_id, overtime_date, start_time, end_time, hours } = overtime;
    
    if (!employee_id || !overtime_date || !start_time || !end_time || !hours) {
      return { valid: false, message: '缺少必填字段' };
    }

    if (hours <= 0) {
      return { valid: false, message: '加班时长必须大于0' };
    }

    if (hours > 24) {
      return { valid: false, message: '加班时长不能超过24小时' };
    }

    return { valid: true };
  }

  static async create(data, operatorId, operatorName) {
    const validation = this.validateOvertime(data);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    return new Promise((resolve, reject) => {
      const { employee_id, overtime_date, start_time, end_time, hours } = data;
      
      const sql = `INSERT INTO overtime_approvals (employee_id, overtime_date, start_time, end_time, hours, status) VALUES (?, ?, ?, ?, ?, 'pending')`;
      db.run(sql, [employee_id, overtime_date, start_time, end_time, hours], async function(err) {
        if (err) return reject(err);

        const overtimeId = this.lastID;
        await LogService.logOperation('overtime', overtimeId, 'create', operatorId, operatorName, null, data);
        
        resolve({ id: overtimeId, ...data, status: 'pending' });
      });
    });
  }

  static async approve(id, approverId, approverName) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM overtime_approvals WHERE id = ?`, [id], async (err, overtime) => {
        if (err) return reject(err);
        if (!overtime) return reject(new Error('加班审批不存在'));
        if (overtime.status !== 'pending') {
          return reject(new Error('只能审批待处理的加班申请'));
        }

        const sql = `UPDATE overtime_approvals SET status = 'approved', approver_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [approverId, id], async function(err) {
          if (err) return reject(err);

          await LogService.logOperation('overtime', id, 'approve', approverId, approverName, overtime, { ...overtime, status: 'approved' });
          await LogService.logModification('overtime', id, 'status', 'pending', 'approved', approverId, approverName);

          resolve({ success: true, message: '审批通过' });
        });
      });
    });
  }

  static async reject(id, approverId, approverName, reason) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM overtime_approvals WHERE id = ?`, [id], async (err, overtime) => {
        if (err) return reject(err);
        if (!overtime) return reject(new Error('加班审批不存在'));

        const sql = `UPDATE overtime_approvals SET status = 'rejected', approver_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [approverId, id], async function(err) {
          if (err) return reject(err);

          await LogService.logOperation('overtime', id, 'reject', approverId, approverName, overtime, { ...overtime, status: 'rejected' });
          await LogService.logModification('overtime', id, 'status', overtime.status, 'rejected', approverId, approverName);

          resolve({ success: true, message: '已拒绝' });
        });
      });
    });
  }

  static getApprovedOvertime(employeeId, date) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM overtime_approvals WHERE employee_id = ? AND overtime_date = ? AND status = 'approved'`;
      db.get(sql, [employeeId, date], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT o.*, e.name as employee_name FROM overtime_approvals o LEFT JOIN employees e ON o.employee_id = e.id ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = OvertimeService;
