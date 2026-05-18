const { Database } = require('./database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const STATUS_FLOW = {
  pending: ['rectifying'],
  rectifying: ['submitted'],
  submitted: ['approved', 'rejected'],
  rejected: ['rectifying'],
  approved: ['closed'],
  closed: []
};

class RectificationModel {
  constructor() {
    this.db = new Database();
  }

  async importItems(batchId, items) {
    const results = {
      success: [],
      errors: [],
      conflicts: []
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;
      
      try {
        const validation = await this.validateItem(item, rowNum);
        
        if (!validation.valid) {
          await this.logImportError(batchId, rowNum, item, validation.errors);
          results.errors.push({
            row: rowNum,
            originalData: item,
            errors: validation.errors
          });
          continue;
        }

        const conflictCheck = await this.checkConflicts(item);
        if (conflictCheck.hasConflict) {
          const itemId = await this.createConflictItem(item, conflictCheck);
          results.conflicts.push({
            row: rowNum,
            itemId,
            originalData: item,
            conflictType: conflictCheck.type,
            conflictDetail: conflictCheck.detail,
            suggestion: conflictCheck.suggestion
          });
        } else {
          const itemId = await this.createNormalItem(item);
          results.success.push({
            row: rowNum,
            itemId,
            data: item
          });
        }
      } catch (error) {
        await this.logImportError(batchId, rowNum, item, [{
          field: 'system',
          reason: '系统处理异常',
          suggestion: '请联系技术支持排查问题'
        }]);
        results.errors.push({
          row: rowNum,
          originalData: item,
          errors: [{ reason: error.message, suggestion: '重试或联系管理员' }]
        });
      }
    }

    return results;
  }

  async validateItem(item, rowNum) {
    const errors = [];
    const requiredFields = [
      'inspection_id', 'store_id', 'store_name',
      'problem_category', 'problem_type', 'problem_description',
      'requirement', 'deadline', 'inspector_id', 'inspector_name',
      'inspection_date'
    ];

    for (const field of requiredFields) {
      if (!item[field] || String(item[field]).trim() === '') {
        errors.push({
          field,
          reason: `字段[${field}]不能为空`,
          suggestion: `请补充${field}的有效信息后重新导入`
        });
      }
    }

    if (item.deadline) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(item.deadline)) {
        errors.push({
          field: 'deadline',
          reason: `整改期限格式错误，应为YYYY-MM-DD格式`,
          suggestion: '请将整改期限修改为正确的日期格式，例如：2024-01-15'
        });
      } else {
        const deadlineDate = new Date(item.deadline);
        if (isNaN(deadlineDate.getTime())) {
          errors.push({
            field: 'deadline',
            reason: `整改期限不是有效的日期`,
            suggestion: '请输入有效的日期，例如：2024-01-15'
          });
        }
      }
    }

    if (item.problem_category) {
      const validCategories = ['环境卫生', '商品陈列', '服务规范', '设备设施', '消防安全', '食品安全', '价格标识', '其他'];
      if (!validCategories.includes(item.problem_category)) {
        errors.push({
          field: 'problem_category',
          reason: `问题分类[${item.problem_category}]不在允许范围内`,
          suggestion: `请从以下分类中选择：${validCategories.join('、')}`
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async checkConflicts(item) {
    const conflicts = { hasConflict: false, type: null, detail: null, suggestion: null };

    if (item.photo_url) {
      const photoHash = this.calculatePhotoHash(item.photo_url);
      const existing = await this.db.get(
        'SELECT item_id, problem_description FROM rectification_items WHERE photo_hash = ? AND status != ?',
        [photoHash, 'closed']
      );
      if (existing) {
        conflicts.hasConflict = true;
        conflicts.type = 'duplicate_photo';
        conflicts.detail = `该照片已在问题"${existing.problem_description}"中使用，存在重复提交嫌疑`;
        conflicts.suggestion = '请确认是否为同一问题，如需继续可人工备注说明原因';
        return conflicts;
      }
    }

    if (item.photo_url) {
      const photoHash = this.calculatePhotoHash(item.photo_url);
      const similarItems = await this.db.all(`
        SELECT item_id, problem_description, status, created_at
        FROM rectification_items 
        WHERE store_id = ? 
          AND problem_category = ? 
          AND ABS(JULIANDAY(created_at) - JULIANDAY(?)) <= 3
          AND status != 'closed'
        ORDER BY created_at DESC
      `, [item.store_id, item.problem_category, new Date().toISOString()]);

      if (similarItems.length > 0) {
        conflicts.hasConflict = true;
        conflicts.type = 'similar_problem';
        conflicts.detail = `发现${similarItems.length}条相似问题记录（3天内同分类）`;
        conflicts.suggestion = '请核实是否为重复问题，如需继续请添加备注说明差异';
        return conflicts;
      }
    }

    if (item.inspection_id && item.problem_description) {
      const existing = await this.db.get(`
        SELECT item_id, status FROM rectification_items 
        WHERE inspection_id = ? AND problem_description = ?
      `, [item.inspection_id, item.problem_description]);

      if (existing) {
        conflicts.hasConflict = true;
        conflicts.type = 'duplicate_problem';
        conflicts.detail = `同一巡检单中已存在相同问题描述，当前状态：${existing.status}`;
        conflicts.suggestion = '请确认是否重复录入，如确需新增请修改问题描述或备注说明';
        return conflicts;
      }
    }

    if (item.report_consistency_check === 'fail') {
      conflicts.hasConflict = true;
      conflicts.type = 'report_inconsistency';
      conflicts.detail = '整改报表与巡检原始记录存在不一致';
      conflicts.suggestion = '请人工核对报表数据一致性，确认无误后备注推进';
    }

    return conflicts;
  }

  async createNormalItem(item) {
    const itemId = uuidv4();
    const photoHash = item.photo_url ? this.calculatePhotoHash(item.photo_url) : null;

    await this.db.run(`
      INSERT INTO rectification_items (
        item_id, inspection_id, store_id, problem_category, problem_type,
        problem_description, problem_location, photo_url, photo_hash,
        requirement, deadline, responsible_person, status, is_conflict
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      itemId, item.inspection_id, item.store_id, item.problem_category, item.problem_type,
      item.problem_description, item.problem_location, item.photo_url, photoHash,
      item.requirement, item.deadline, item.responsible_person, 'pending'
    ]);

    return itemId;
  }

  async createConflictItem(item, conflictCheck) {
    const itemId = uuidv4();
    const photoHash = item.photo_url ? this.calculatePhotoHash(item.photo_url) : null;

    await this.db.run(`
      INSERT INTO rectification_items (
        item_id, inspection_id, store_id, problem_category, problem_type,
        problem_description, problem_location, photo_url, photo_hash,
        requirement, deadline, responsible_person, status, is_conflict,
        conflict_type, conflict_remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      itemId, item.inspection_id, item.store_id, item.problem_category, item.problem_type,
      item.problem_description, item.problem_location, item.photo_url, photoHash,
      item.requirement, item.deadline, item.responsible_person, 'pending',
      conflictCheck.type, JSON.stringify(conflictCheck)
    ]);

    return itemId;
  }

  async logImportError(batchId, rowNum, item, errors) {
    for (const error of errors) {
      const errorId = uuidv4();
      await this.db.run(`
        INSERT INTO import_errors (
          error_id, import_batch_id, row_number, original_data,
          error_reason, suggestion, error_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        errorId, batchId, rowNum, JSON.stringify(item),
        error.reason, error.suggestion,
        error.field || 'unknown'
      ]);
    }
  }

  calculatePhotoHash(url) {
    return crypto.createHash('md5').update(String(url)).digest('hex');
  }

  async checkStatusTransition(currentStatus, nextStatus) {
    const allowedNext = STATUS_FLOW[currentStatus] || [];
    return allowedNext.includes(nextStatus);
  }

  async updateStatusWithRemark(itemId, newStatus, operatorId, operatorName, remark) {
    const item = await this.db.get('SELECT status FROM rectification_items WHERE item_id = ?', [itemId]);
    if (!item) {
      throw new Error('整改项不存在');
    }

    const canTransition = await this.checkStatusTransition(item.status, newStatus);
    if (!canTransition) {
      throw new Error(`不允许从状态[${item.status}]直接跳转到[${newStatus}]`);
    }

    const logId = uuidv4();
    await this.db.run(`
      INSERT INTO remark_logs (
        log_id, item_id, operator_id, operator_name, remark,
        operation_type, previous_status, new_status
      ) VALUES (?, ?, ?, ?, ?, 'status_change', ?, ?)
    `, [logId, itemId, operatorId, operatorName, remark, item.status, newStatus]);

    await this.db.run(`
      UPDATE rectification_items 
      SET status = ?, updated_at = CURRENT_TIMESTAMP, is_conflict = 0
      WHERE item_id = ?
    `, [newStatus, itemId]);

    return { success: true, itemId, previousStatus: item.status, newStatus };
  }

  async resolveConflict(itemId, operatorId, operatorName, remark) {
    const item = await this.db.get('SELECT status, is_conflict FROM rectification_items WHERE item_id = ?', [itemId]);
    if (!item) {
      throw new Error('整改项不存在');
    }

    const logId = uuidv4();
    await this.db.run(`
      INSERT INTO remark_logs (
        log_id, item_id, operator_id, operator_name, remark,
        operation_type, previous_status, new_status
      ) VALUES (?, ?, ?, ?, ?, 'conflict_resolve', ?, ?)
    `, [logId, itemId, operatorId, operatorName, remark, item.status, item.status]);

    await this.db.run(`
      UPDATE rectification_items 
      SET is_conflict = 0, conflict_remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = ?
    `, [remark, itemId]);

    return { success: true, itemId, message: '冲突已解决，可继续推进' };
  }

  async getItemDetails(itemId) {
    const item = await this.db.get(`
      SELECT ri.*, s.store_name, i.inspector_name
      FROM rectification_items ri
      LEFT JOIN inspections i ON ri.inspection_id = i.inspection_id
      LEFT JOIN stores s ON ri.store_id = s.store_id
      WHERE ri.item_id = ?
    `, [itemId]);

    if (!item) return null;

    const remarks = await this.db.all(`
      SELECT * FROM remark_logs 
      WHERE item_id = ? 
      ORDER BY created_at DESC
    `, [itemId]);

    const records = await this.db.all(`
      SELECT * FROM rectification_records 
      WHERE item_id = ? 
      ORDER BY created_at DESC
    `, [itemId]);

    return { ...item, remarks, records };
  }

  async getImportErrors(batchId) {
    return await this.db.all(`
      SELECT * FROM import_errors 
      WHERE import_batch_id = ? 
      ORDER BY row_number ASC
    `, [batchId]);
  }

  close() {
    return this.db.close();
  }
}

module.exports = RectificationModel;