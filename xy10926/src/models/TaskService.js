const db = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

const TASK_STATUSES = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  UNDER_INSPECTION: 'under_inspection',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  NEEDS_REWORK: 'needs_rework'
};

const VALID_TRANSITIONS = {
  [TASK_STATUSES.PENDING]: [TASK_STATUSES.ASSIGNED],
  [TASK_STATUSES.ASSIGNED]: [TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.PENDING],
  [TASK_STATUSES.IN_PROGRESS]: [TASK_STATUSES.COMPLETED, TASK_STATUSES.ASSIGNED],
  [TASK_STATUSES.COMPLETED]: [TASK_STATUSES.UNDER_INSPECTION, TASK_STATUSES.IN_PROGRESS],
  [TASK_STATUSES.UNDER_INSPECTION]: [TASK_STATUSES.ACCEPTED, TASK_STATUSES.REJECTED, TASK_STATUSES.NEEDS_REWORK, TASK_STATUSES.COMPLETED],
  [TASK_STATUSES.REJECTED]: [TASK_STATUSES.NEEDS_REWORK, TASK_STATUSES.UNDER_INSPECTION],
  [TASK_STATUSES.NEEDS_REWORK]: [TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.UNDER_INSPECTION],
  [TASK_STATUSES.ACCEPTED]: [TASK_STATUSES.UNDER_INSPECTION]
};

class TaskService {
  static canTransition(currentStatus, nextStatus) {
    const validNext = VALID_TRANSITIONS[currentStatus];
    return validNext && validNext.includes(nextStatus);
  }

  static transitionTask(taskId, newStatus, triggeredBy, reason = '') {
    const task = db.prepare('SELECT * FROM cleaning_tasks WHERE id = ?').get(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (!this.canTransition(task.status, newStatus)) {
      throw new Error(`无效的状态转换: ${task.status} -> ${newStatus}`);
    }

    const previousStatus = task.status;
    let reworkCount = task.rework_count;

    if (newStatus === TASK_STATUSES.NEEDS_REWORK && task.status !== TASK_STATUSES.NEEDS_REWORK) {
      reworkCount += 1;
      db.prepare(`
        INSERT INTO rework_history (task_id, rework_number, previous_status, new_status, reason, triggered_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, reworkCount, previousStatus, newStatus, reason, triggeredBy);
    }

    const updateFields = { status: newStatus, rework_count: reworkCount };
    
    const statusTimeFields = {
      [TASK_STATUSES.ASSIGNED]: 'assigned_at',
      [TASK_STATUSES.IN_PROGRESS]: 'started_at',
      [TASK_STATUSES.COMPLETED]: 'completed_at',
      [TASK_STATUSES.ACCEPTED]: 'accepted_at',
      [TASK_STATUSES.REJECTED]: 'rejected_at'
    };
    
    if (statusTimeFields[newStatus]) {
      updateFields[statusTimeFields[newStatus]] = new Date().toISOString();
    }

    db.prepare(`
      UPDATE cleaning_tasks 
      SET status = ?, rework_count = ?, updated_at = CURRENT_TIMESTAMP
      ${statusTimeFields[newStatus] ? `, ${statusTimeFields[newStatus]} = CURRENT_TIMESTAMP` : ''}
      WHERE id = ?
    `).run(newStatus, reworkCount, taskId);

    return { taskId, previousStatus, newStatus, success: true };
  }

  static checkDuplicateAcceptance(taskId) {
    const report = db.prepare('SELECT * FROM acceptance_reports WHERE task_id = ?').get(taskId);
    return report !== undefined;
  }

  static createTask(propertyId, taskDate, cleanerName, notes = '') {
    const result = db.prepare(`
      INSERT INTO cleaning_tasks (property_id, task_date, cleaner_name, notes, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(propertyId, taskDate, cleanerName, notes, TASK_STATUSES.PENDING);

    const taskId = result.lastInsertRowid;
    this.initializeTaskCheckItems(taskId, propertyId);
    
    return { id: taskId, ...this.getTaskById(taskId) };
  }

  static initializeTaskCheckItems(taskId, propertyId) {
    const checkItems = db.prepare(`
      SELECT id FROM check_items 
      WHERE status = 'active' AND (property_id = ? OR property_id IS NULL)
    `).all(propertyId);

    const insert = db.prepare(`
      INSERT INTO task_check_items (task_id, check_item_id)
      VALUES (?, ?)
    `);

    for (const item of checkItems) {
      try {
        insert.run(taskId, item.id);
      } catch (e) {
      }
    }
  }

  static getTaskById(taskId) {
    return db.prepare('SELECT * FROM cleaning_tasks WHERE id = ?').get(taskId);
  }

  static getTaskWithDetails(taskId) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const checkItems = db.prepare(`
      SELECT tci.*, ci.name, ci.category, ci.description, ci.is_required
      FROM task_check_items tci
      JOIN check_items ci ON tci.check_item_id = ci.id
      WHERE tci.task_id = ?
      ORDER BY ci.sort_order, ci.name
    `).all(taskId);

    const photos = db.prepare('SELECT * FROM photo_evidence WHERE task_id = ?').all(taskId);
    const reworkHistory = db.prepare('SELECT * FROM rework_history WHERE task_id = ? ORDER BY created_at').all(taskId);

    return { ...task, checkItems, photos, reworkHistory };
  }

  static updateCheckItem(taskCheckItemId, isPassed, checkedBy, notes = '') {
    const taskCheckItem = db.prepare('SELECT * FROM task_check_items WHERE id = ?').get(taskCheckItemId);
    if (!taskCheckItem) {
      throw new Error('检查项不存在');
    }

    const task = this.getTaskById(taskCheckItem.task_id);
    if (task.status === TASK_STATUSES.ACCEPTED) {
      throw new Error('任务已验收，无法修改检查项');
    }

    db.prepare(`
      UPDATE task_check_items
      SET is_passed = ?, checked_by = ?, checked_at = CURRENT_TIMESTAMP, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(isPassed ? 1 : 0, checkedBy, notes, taskCheckItemId);

    return db.prepare('SELECT * FROM task_check_items WHERE id = ?').get(taskCheckItemId);
  }

  static addPhotoEvidence(taskId, taskCheckItemId, photoPath, photoType, uploadedBy, notes = '') {
    const result = db.prepare(`
      INSERT INTO photo_evidence (task_id, task_check_item_id, photo_path, photo_type, uploaded_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, taskCheckItemId || null, photoPath, photoType, uploadedBy, notes);

    return { id: result.lastInsertRowid, taskId, photoPath, photoType };
  }

  static createAcceptanceReport(taskId, inspectorName) {
    if (this.checkDuplicateAcceptance(taskId)) {
      throw new Error('该任务已存在验收报告，请勿重复验收');
    }

    const task = this.getTaskWithDetails(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const totalItems = task.checkItems.length;
    const passedItems = task.checkItems.filter(i => i.is_passed).length;
    const failedItems = totalItems - passedItems;
    const overallResult = failedItems === 0 ? 'pass' : 'fail';

    const reportNumber = `ACC-${Date.now()}-${uuidv4().substr(0, 8).toUpperCase()}`;

    const result = db.prepare(`
      INSERT INTO acceptance_reports (task_id, report_number, inspector_name, inspected_at, total_items, passed_items, failed_items, overall_result)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
    `).run(taskId, reportNumber, inspectorName, totalItems, passedItems, failedItems, overallResult);

    if (overallResult === 'pass') {
      this.transitionTask(taskId, TASK_STATUSES.ACCEPTED, inspectorName, '验收通过');
    } else {
      this.transitionTask(taskId, TASK_STATUSES.NEEDS_REWORK, inspectorName, `验收不通过，${failedItems}项未通过`);
    }

    return { id: result.lastInsertRowid, reportNumber, totalItems, passedItems, failedItems, overallResult };
  }

  static manualCorrectTask(taskId, newStatus, correctedBy, reason = '') {
    const task = this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const previousStatus = task.status;

    db.prepare(`
      UPDATE cleaning_tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, taskId);

    db.prepare(`
      INSERT INTO rework_history (task_id, rework_number, previous_status, new_status, reason, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, task.rework_count, previousStatus, newStatus, `人工修正: ${reason}`, correctedBy);

    return { taskId, previousStatus, newStatus, success: true, type: 'manual_correction' };
  }

  static listTasks(filters = {}) {
    let query = 'SELECT * FROM cleaning_tasks WHERE 1=1';
    const params = [];

    if (filters.propertyId) {
      query += ' AND property_id = ?';
      params.push(filters.propertyId);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      query += ' AND task_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND task_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY task_date DESC, id DESC';

    return db.prepare(query).all(...params);
  }
}

module.exports = { TaskService, TASK_STATUSES, VALID_TRANSITIONS };
