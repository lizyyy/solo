const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const STATUS_FLOW = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'delayed'],
  delayed: ['completed'],
  completed: [],
  cancelled: []
};

class DetourService {
  async createDetourPlan(data) {
    const { route_id, reason_id, plan_date, start_time, end_time, estimated_delay, operator, remark, stop_replacements } = data;
    
    const planId = uuidv4();
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      const insertPlan = db.prepare(`
        INSERT INTO detour_plans (id, route_id, reason_id, plan_date, start_time, end_time, status, estimated_delay, operator, remark, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `);
      insertPlan.run(planId, route_id, reason_id, plan_date, start_time, end_time, estimated_delay || 0, operator, remark, now, now);

      if (stop_replacements && stop_replacements.length > 0) {
        const insertReplacement = db.prepare(`
          INSERT INTO detour_stop_replacements (id, detour_plan_id, original_stop_id, temp_stop_id, new_arrival_time)
          VALUES (?, ?, ?, ?, ?)
        `);

        const affectedStudentIds = new Set();
        stop_replacements.forEach(replacement => {
          const replacementId = uuidv4();
          insertReplacement.run(replacementId, planId, replacement.original_stop_id, replacement.temp_stop_id, replacement.new_arrival_time);

          const students = db.prepare(`
            SELECT id FROM students WHERE default_stop_id = ? AND route_id = ? AND status = 'active'
          `).all(replacement.original_stop_id, route_id);

          students.forEach(s => affectedStudentIds.add(s.id));
        });

        const insertAffected = db.prepare(`
          INSERT INTO detour_affected_students (id, detour_plan_id, student_id, original_stop_id, new_stop_id)
          VALUES (?, ?, ?, ?, ?)
        `);

        affectedStudentIds.forEach(studentId => {
          const student = db.prepare('SELECT default_stop_id FROM students WHERE id = ?').get(studentId);
          const replacement = stop_replacements.find(r => r.original_stop_id === student.default_stop_id);
          insertAffected.run(uuidv4(), planId, studentId, student.default_stop_id, replacement ? replacement.temp_stop_id : null);
        });
      }

      this.logOperation(planId, 'create', operator, null, JSON.stringify(data), '创建改线计划');
    });

    transaction();
    return this.getDetourPlanById(planId);
  }

  getDetourPlanById(id) {
    const plan = db.prepare(`
      SELECT dp.*, r.route_name, r.route_code, dr.reason_name, dr.severity
      FROM detour_plans dp
      JOIN routes r ON dp.route_id = r.id
      JOIN detour_reasons dr ON dp.reason_id = dr.id
      WHERE dp.id = ?
    `).get(id);

    if (!plan) return null;

    plan.stop_replacements = db.prepare(`
      SELECT dsr.*, s1.stop_name as original_stop_name, s2.stop_name as temp_stop_name
      FROM detour_stop_replacements dsr
      JOIN stops s1 ON dsr.original_stop_id = s1.id
      JOIN stops s2 ON dsr.temp_stop_id = s2.id
      WHERE dsr.detour_plan_id = ?
    `).all(id);

    plan.affected_students = db.prepare(`
      SELECT das.*, s.student_name, s.student_no, s.parent_name, s.parent_phone
      FROM detour_affected_students das
      JOIN students s ON das.student_id = s.id
      WHERE das.detour_plan_id = ?
    `).all(id);

    plan.receipts = db.prepare(`
      SELECT pr.*, s.student_name
      FROM parent_receipts pr
      JOIN students s ON pr.student_id = s.id
      WHERE pr.detour_plan_id = ?
    `).all(id);

    plan.status_transitions = db.prepare(`
      SELECT * FROM status_transitions WHERE detour_plan_id = ? ORDER BY created_at
    `).all(id);

    return plan;
  }

  listDetourPlans(filters = {}) {
    let sql = `
      SELECT dp.*, r.route_name, r.route_code, dr.reason_name, dr.severity
      FROM detour_plans dp
      JOIN routes r ON dp.route_id = r.id
      JOIN detour_reasons dr ON dp.reason_id = dr.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND dp.status = ?';
      params.push(filters.status);
    }
    if (filters.route_id) {
      sql += ' AND dp.route_id = ?';
      params.push(filters.route_id);
    }
    if (filters.plan_date) {
      sql += ' AND dp.plan_date = ?';
      params.push(filters.plan_date);
    }

    sql += ' ORDER BY dp.created_at DESC';

    return db.prepare(sql).all(...params);
  }

  transitionStatus(id, targetStatus, operator, remark = '') {
    const plan = db.prepare('SELECT status FROM detour_plans WHERE id = ?').get(id);
    if (!plan) throw new Error('改线计划不存在');

    const allowedTransitions = STATUS_FLOW[plan.status] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new Error(`不允许从 ${plan.status} 转换到 ${targetStatus}`);
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE detour_plans SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(targetStatus, id);

      db.prepare(`
        INSERT INTO status_transitions (id, detour_plan_id, from_status, to_status, operator, remark)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), id, plan.status, targetStatus, operator, remark);

      this.logOperation(id, 'status_change', operator, plan.status, targetStatus, remark);
    });

    transaction();
    return this.getDetourPlanById(id);
  }

  async addParentReceipt(data) {
    const { detour_plan_id, student_id, parent_phone, confirm_type, message, is_late, late_reason, source } = data;

    const existing = db.prepare(`
      SELECT id FROM parent_receipts 
      WHERE detour_plan_id = ? AND student_id = ? AND parent_phone = ?
    `).get(detour_plan_id, student_id, parent_phone);

    if (existing) {
      throw new Error('该家长已提交回执，请勿重复提交');
    }

    const receiptId = uuidv4();
    db.prepare(`
      INSERT INTO parent_receipts (id, detour_plan_id, student_id, parent_phone, confirm_type, message, is_late, late_reason, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receiptId, detour_plan_id, student_id, parent_phone, confirm_type, message, is_late ? 1 : 0, late_reason, source);

    return db.prepare('SELECT * FROM parent_receipts WHERE id = ?').get(receiptId);
  }

  getReceiptsByPlan(detour_plan_id) {
    return db.prepare(`
      SELECT pr.*, s.student_name, s.student_no, s.parent_name
      FROM parent_receipts pr
      JOIN students s ON pr.student_id = s.id
      WHERE pr.detour_plan_id = ?
      ORDER BY pr.created_at DESC
    `).all(detour_plan_id);
  }

  async manualCorrect(id, data, operator) {
    const plan = this.getDetourPlanById(id);
    if (!plan) throw new Error('改线计划不存在');

    const allowedFields = ['plan_date', 'start_time', 'end_time', 'estimated_delay', 'remark', 'status'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates[field] = data[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('没有需要更新的字段');
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE detour_plans SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
      this.logOperation(id, 'manual_correct', operator, JSON.stringify(plan), JSON.stringify(data), '人工修正');
    });

    transaction();
    return this.getDetourPlanById(id);
  }

  logError(apiPath, method, rawInput, errorMessage, processingResult) {
    db.prepare(`
      INSERT INTO error_logs (id, api_path, request_method, raw_input, error_message, processing_result)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), apiPath, method, JSON.stringify(rawInput), errorMessage, processingResult);
  }

  logOperation(detourPlanId, operationType, operator, beforeData, afterData, remark) {
    db.prepare(`
      INSERT INTO operation_logs (id, detour_plan_id, operation_type, operator, before_data, after_data, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), detourPlanId, operationType, operator, beforeData, afterData, remark);
  }

  generateReport(detour_plan_id) {
    const plan = this.getDetourPlanById(detour_plan_id);
    if (!plan) throw new Error('改线计划不存在');

    const totalStudents = plan.affected_students.length;
    const confirmedReceipts = plan.receipts.filter(r => r.confirm_type === 'confirmed').length;
    const lateCount = plan.receipts.filter(r => r.is_late === 1).length;

    return {
      plan_info: {
        id: plan.id,
        route_name: plan.route_name,
        reason_name: plan.reason_name,
        plan_date: plan.plan_date,
        status: plan.status,
        estimated_delay: plan.estimated_delay
      },
      statistics: {
        total_affected_students: totalStudents,
        confirmed_receipts: confirmedReceipts,
        pending_receipts: totalStudents - confirmedReceipts,
        late_count: lateCount,
        confirmation_rate: totalStudents > 0 ? Math.round((confirmedReceipts / totalStudents) * 100) : 0
      },
      stop_replacements: plan.stop_replacements,
      receipts: plan.receipts,
      status_transitions: plan.status_transitions
    };
  }

  getErrorLogs(limit = 50) {
    return db.prepare('SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  markNotified(detour_plan_id, student_ids) {
    const updateStmt = db.prepare(`
      UPDATE detour_affected_students 
      SET notified = 1, notified_at = CURRENT_TIMESTAMP
      WHERE detour_plan_id = ? AND student_id = ?
    `);

    const transaction = db.transaction(() => {
      student_ids.forEach(studentId => {
        updateStmt.run(detour_plan_id, studentId);
      });
    });

    transaction();
    return { success: true, notified_count: student_ids.length };
  }
}

module.exports = new DetourService();
