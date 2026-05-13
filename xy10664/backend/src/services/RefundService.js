const db = require('../models/database');
const LogService = require('./LogService');
const RuleService = require('./RuleService');
const BudgetService = require('./BudgetService');
const OrderService = require('./OrderService');

class RefundService {
  static async createRequest(data, operatorId, operatorName) {
    const { order_id, employee_id, department_id, amount, reason } = data;
    
    if (!order_id || !employee_id || !department_id || !amount) {
      throw new Error('缺少必填字段');
    }

    const existingRefund = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM refund_requests WHERE order_id = ? AND status NOT IN ('rejected', 'cancelled')`, [order_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingRefund) {
      throw new Error('该订单已有正在处理的退款申请');
    }

    const order = await OrderService.getById(order_id);
    if (!order) {
      throw new Error('订单不存在');
    }

    const ruleResult = await RuleService.applyRules({
      employee_id,
      department_id,
      amount,
      order_date: order.order_date
    });

    const status = ruleResult.approved ? 'approved' : (ruleResult.needReview ? 'pending' : 'rejected');

    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO refund_requests (order_id, employee_id, department_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(sql, [order_id, employee_id, department_id, amount, reason || null, status], async function(err) {
        if (err) return reject(err);

        const refundId = this.lastID;
        await LogService.logOperation('refund', refundId, 'create', operatorId, operatorName, null, { ...data, status });

        if (status === 'approved') {
          const period = new Date().toISOString().slice(0, 7);
          await BudgetService.refundBudget(department_id, period, amount, operatorId, operatorName);
        }

        resolve({
          id: refundId,
          ...data,
          status,
          rule_result: ruleResult
        });
      });
    });
  }

  static async reviewRequest(id, reviewerId, reviewerName, decision, comment) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM refund_requests WHERE id = ?`, [id], async (err, refund) => {
        if (err) return reject(err);
        if (!refund) return reject(new Error('退款申请不存在'));
        if (refund.status !== 'pending') {
          return reject(new Error('只能审核待处理的退款申请'));
        }

        const newStatus = decision === 'approve' ? 'approved' : 'rejected';
        const sql = `UPDATE refund_requests SET status = ?, reviewer_id = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        
        db.run(sql, [newStatus, reviewerId, comment || null, id], async function(err) {
          if (err) return reject(err);

          await LogService.logOperation('refund', id, 'review', reviewerId, reviewerName, refund, { ...refund, status: newStatus });
          await LogService.logModification('refund', id, 'status', refund.status, newStatus, reviewerId, reviewerName);

          if (newStatus === 'approved') {
            const period = new Date().toISOString().slice(0, 7);
            await BudgetService.refundBudget(refund.department_id, period, refund.amount, reviewerId, reviewerName);
          }

          resolve({ success: true, status: newStatus });
        });
      });
    });
  }

  static async reverseRefund(refundId, operatorId, operatorName, reason) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM refund_requests WHERE id = ?`, [refundId], async (err, refund) => {
        if (err) return reject(err);
        if (!refund) return reject(new Error('退款申请不存在'));
        if (refund.status !== 'approved') {
          return reject(new Error('只能逆转已批准的退款申请'));
        }

        const previousStatus = refund.status;
        const newStatus = 'reversed';

        const sql = `UPDATE refund_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [newStatus, refundId], async function(err) {
          if (err) return reject(err);

          const period = new Date().toISOString().slice(0, 7);
          await BudgetService.consumeBudget(refund.department_id, period, refund.amount, operatorId, operatorName);

          const affectedRecords = JSON.stringify({
            refund_request: refundId,
            budget: { department_id: refund.department_id, period, amount: refund.amount }
          });

          await db.run(
            `INSERT INTO refund_reversals (refund_request_id, operator_id, operator_name, reason, previous_status, new_status, affected_records) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [refundId, operatorId, operatorName, reason, previousStatus, newStatus, affectedRecords]
          );

          await LogService.logOperation('refund', refundId, 'reverse', operatorId, operatorName, refund, { ...refund, status: newStatus });

          resolve({ success: true, status: newStatus });
        });
      });
    });
  }

  static getReversals(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT r.*, e.name as employee_name, d.name as department_name 
                 FROM refund_reversals r 
                 LEFT JOIN refund_requests rr ON r.refund_request_id = rr.id
                 LEFT JOIN employees e ON rr.employee_id = e.id
                 LEFT JOIN departments d ON rr.department_id = d.id
                 WHERE 1=1`;
      const params = [];

      if (filters.operatorName) {
        sql += ` AND r.operator_name LIKE ?`;
        params.push(`%${filters.operatorName}%`);
      }
      if (filters.startTime) {
        sql += ` AND r.created_at >= ?`;
        params.push(filters.startTime);
      }
      if (filters.endTime) {
        sql += ` AND r.created_at <= ?`;
        params.push(filters.endTime);
      }

      sql += ` ORDER BY r.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT r.*, e.name as employee_name, d.name as department_name 
              FROM refund_requests r 
              LEFT JOIN employees e ON r.employee_id = e.id
              LEFT JOIN departments d ON r.department_id = d.id
              ORDER BY r.created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM refund_requests WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getTimeline(refundId) {
    return Promise.all([
      LogService.getModificationHistory('refund', refundId),
      new Promise((resolve) => {
        db.all(`SELECT * FROM refund_reversals WHERE refund_request_id = ?`, [refundId], (err, rows) => {
          resolve(rows || []);
        });
      })
    ]).then(([modifications, reversals]) => {
      const timeline = [
        ...modifications.map(m => ({
          type: 'modification',
          time: m.created_at,
          operator: m.operator_name,
          field: m.field_name,
          old_value: m.old_value,
          new_value: m.new_value
        })),
        ...reversals.map(r => ({
          type: 'reversal',
          time: r.created_at,
          operator: r.operator_name,
          reason: r.reason,
          previous_status: r.previous_status,
          new_status: r.new_status,
          affected_records: r.affected_records
        }))
      ];

      return timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
    });
  }
}

module.exports = RefundService;
