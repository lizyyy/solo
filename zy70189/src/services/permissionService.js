const { getConnection } = require('../database');
const config = require('../../config');
const logger = require('../logger');

class PermissionService {
  constructor() {
    this.db = getConnection();
    this.levelHierarchy = ['junior', 'intermediate', 'senior', 'supervisor', 'manager', 'director'];
  }

  getStaffLevelOrder(level) {
    const index = this.levelHierarchy.indexOf(level);
    return index === -1 ? -1 : index;
  }

  isHigherOrEqualLevel(level1, level2) {
    return this.getStaffLevelOrder(level1) >= this.getStaffLevelOrder(level2);
  }

  isHigherLevel(level1, level2) {
    return this.getStaffLevelOrder(level1) > this.getStaffLevelOrder(level2);
  }

  getStaffById(staffId) {
    return this.db.prepare(`
      SELECT id, name, level, is_active
      FROM staff
      WHERE id = ?
    `).get(staffId);
  }

  getCategoryRule(categoryCode) {
    return this.db.prepare(`
      SELECT id, category_code, category_name, is_refundable, 
             max_refund_ratio, special_approval_required
      FROM category_rules
      WHERE category_code = ?
    `).get(categoryCode);
  }

  getAllCategories() {
    return this.db.prepare(`
      SELECT id, category_code, category_name, is_refundable, 
             max_refund_ratio, special_approval_required
      FROM category_rules
      ORDER BY category_code
    `).all();
  }

  createCategoryRule(ruleData, operatorId) {
    const { category_code, category_name, is_refundable = 1, 
            max_refund_ratio = 1, special_approval_required = 0 } = ruleData;

    const existing = this.getCategoryRule(category_code);
    if (existing) {
      throw new Error(`品类代码 ${category_code} 已存在`);
    }

    const now = Math.floor(Date.now() / 1000);
    const result = this.db.prepare(`
      INSERT INTO category_rules 
      (category_code, category_name, is_refundable, max_refund_ratio, special_approval_required, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(category_code, category_name, is_refundable ? 1 : 0, 
           max_refund_ratio, special_approval_required ? 1 : 0, now, now);

    logger.info('创建品类规则', { category_code, operator_id: operatorId });
    return result.lastInsertRowid;
  }

  updateCategoryRule(categoryCode, updates, operatorId) {
    const existing = this.getCategoryRule(categoryCode);
    if (!existing) {
      throw new Error(`品类代码 ${categoryCode} 不存在`);
    }

    const now = Math.floor(Date.now() / 1000);
    const fields = [];
    const values = [];

    if (updates.category_name !== undefined) {
      fields.push('category_name = ?');
      values.push(updates.category_name);
    }
    if (updates.is_refundable !== undefined) {
      fields.push('is_refundable = ?');
      values.push(updates.is_refundable ? 1 : 0);
    }
    if (updates.max_refund_ratio !== undefined) {
      fields.push('max_refund_ratio = ?');
      values.push(updates.max_refund_ratio);
    }
    if (updates.special_approval_required !== undefined) {
      fields.push('special_approval_required = ?');
      values.push(updates.special_approval_required ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(categoryCode);

    this.db.prepare(`UPDATE category_rules SET ${fields.join(', ')} WHERE category_code = ?`).run(...values);

    logger.info('更新品类规则', { category_code: categoryCode, operator_id: operatorId });
    return true;
  }

  getRefundLimit(staffLevel, category) {
    const row = this.db.prepare(`
      SELECT id, staff_level, category, max_amount, effective_from, effective_to
      FROM refund_limits
      WHERE staff_level = ? 
        AND (category = ? OR category IS NULL)
        AND (effective_to IS NULL OR effective_to > strftime('%s', 'now'))
      ORDER BY category DESC
      LIMIT 1
    `).get(staffLevel, category);

    if (row) return row;

    const levelConfig = config.permission.levels[staffLevel];
    if (levelConfig) {
      return {
        staff_level: staffLevel,
        category: category,
        max_amount: levelConfig.maxAmount
      };
    }

    return {
      staff_level: staffLevel,
      category: category,
      max_amount: 0
    };
  }

  getAllRefundLimits() {
    return this.db.prepare(`
      SELECT id, staff_level, category, max_amount, effective_from, effective_to
      FROM refund_limits
      WHERE effective_to IS NULL OR effective_to > strftime('%s', 'now')
      ORDER BY staff_level, category
    `).all();
  }

  setRefundLimit(staffLevel, category, maxAmount, operatorId) {
    const now = Math.floor(Date.now() / 1000);
    const trans = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE refund_limits
        SET effective_to = ?, updated_at = ?
        WHERE staff_level = ? 
          AND (category = ? OR (category IS NULL AND ? IS NULL))
          AND (effective_to IS NULL OR effective_to > ?)
      `).run(now, now, staffLevel, category, category, now);

      return this.db.prepare(`
        INSERT INTO refund_limits (staff_level, category, max_amount, effective_from, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(staffLevel, category || null, maxAmount, now, now, now);
    });

    const result = trans();
    logger.info('设置退款额度', { staff_level: staffLevel, category, max_amount: maxAmount, operator_id: operatorId });
    return result.lastInsertRowid;
  }

  createPermissionMatrix(matrixData, operatorId) {
    const { staff_level, action, is_allowed = 1, category = null, max_amount = null } = matrixData;

    const now = Math.floor(Date.now() / 1000);
    const result = this.db.prepare(`
      INSERT INTO permission_matrix (staff_level, action, is_allowed, category, max_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(staff_level, action, is_allowed ? 1 : 0, category, max_amount, now, now);

    logger.info('创建权限矩阵', { staff_level, action, operator_id: operatorId });
    return result.lastInsertRowid;
  }

  checkPermission(staff, action, amount, category) {
    const checks = [];
    let hasOverrideDenial = false;

    if (!staff || !staff.is_active) {
      return {
        allowed: false,
        reason: '员工不存在或已停用',
        required_approval_level: null,
        checks
      };
    }

    checks.push({ type: 'staff_status', passed: true, detail: '员工状态正常' });

    const categoryRule = this.getCategoryRule(category);
    if (categoryRule) {
      if (!categoryRule.is_refundable) {
        checks.push({ type: 'category_refundable', passed: false, detail: `品类【${category}】不支持退款` });
        return {
          allowed: false,
          reason: `品类【${category}】不支持退款`,
          required_approval_level: null,
          checks
        };
      }
      checks.push({ type: 'category_refundable', passed: true, detail: `品类【${category}】支持退款` });
    }

    const matrix = this.db.prepare(`
      SELECT id, action, is_allowed, category, max_amount
      FROM permission_matrix
      WHERE staff_level = ?
        AND action = ?
        AND (category = ? OR category IS NULL)
      ORDER BY category DESC
      LIMIT 1
    `).get(staff.level, action, category);

    if (matrix && !matrix.is_allowed) {
      checks.push({ type: 'permission_matrix', passed: false, detail: '权限矩阵显式拒绝' });
      return {
        allowed: false,
        reason: '权限矩阵显式拒绝',
        required_approval_level: null,
        checks
      };
    }
    checks.push({ type: 'permission_matrix', passed: true, detail: '权限矩阵检查通过' });

    const refundLimit = this.getRefundLimit(staff.level, category);
    const maxAmount = refundLimit.max_amount;

    if (maxAmount === null) {
      checks.push({ type: 'amount_limit', passed: true, detail: '额度无限制' });
    } else if (amount > maxAmount) {
      checks.push({ type: 'amount_limit', passed: false, 
        detail: `金额 ${amount} 超过当前等级额度 ${maxAmount}` });
      
      const approvalLevel = this.findRequiredApprovalLevel(amount, category);
      return {
        allowed: false,
        reason: '额度超限',
        required_approval_level: approvalLevel,
        amount_limit: maxAmount,
        actual_amount: amount,
        checks
      };
    } else {
      checks.push({ type: 'amount_limit', passed: true, 
        detail: `金额 ${amount} 在额度 ${maxAmount} 范围内` });
    }

    if (categoryRule && categoryRule.special_approval_required) {
      checks.push({ type: 'special_approval', passed: false, 
        detail: `品类【${category}】需要特殊审批` });
      
      return {
        allowed: false,
        reason: '品类特殊审批要求',
        required_approval_level: 'supervisor',
        checks
      };
    }

    return {
      allowed: true,
      reason: '权限检查通过',
      required_approval_level: null,
      checks
    };
  }

  findRequiredApprovalLevel(amount, category) {
    for (let i = this.levelHierarchy.length - 1; i >= 0; i--) {
      const level = this.levelHierarchy[i];
      const limit = this.getRefundLimit(level, category);
      
      if (limit.max_amount === null || amount <= limit.max_amount) {
        return level;
      }
    }
    
    return 'director';
  }

  canApprove(approverLevel, initiatorLevel, amount, category) {
    const levelCheck = this.isHigherOrEqualLevel(approverLevel, initiatorLevel);
    if (!levelCheck) {
      return { allowed: false, reason: '审批人等级需高于或等于发起人' };
    }

    const limit = this.getRefundLimit(approverLevel, category);
    if (limit.max_amount !== null && amount > limit.max_amount) {
      return { 
        allowed: false, 
        reason: '审批人额度不足',
        limit: limit.max_amount,
        actual: amount
      };
    }

    return { allowed: true };
  }

  detectOverrideAttempt(currentStaff, initiatorLevel, amount, category) {
    const permissionResult = this.checkPermission(currentStaff, 'refund', amount, category);
    
    if (permissionResult.allowed) {
      return { is_override: false };
    }

    return {
      is_override: true,
      reason: permissionResult.reason,
      required_approval_level: permissionResult.required_approval_level,
      checks: permissionResult.checks
    };
  }
}

module.exports = new PermissionService();
