const { v4: uuidv4 } = require('uuid');
const { getConnection, runTransaction } = require('../database');
const logger = require('../logger');
const permissionService = require('./permissionService');
const auditService = require('./auditService');
const refundService = require('./refundService');

class ApprovalService {
  constructor() {
    this.db = getConnection();
  }

  getApprovalById(approvalId) {
    return this.db.prepare(`
      SELECT id, refund_request_id, approver_level, approver_id, action, 
             comment, status, created_at, updated_at
      FROM approval_requests
      WHERE id = ?
    `).get(approvalId);
  }

  getApprovalsByRefundRequest(refundRequestId) {
    return this.db.prepare(`
      SELECT id, refund_request_id, approver_level, approver_id, action, 
             comment, status, created_at, updated_at
      FROM approval_requests
      WHERE refund_request_id = ?
      ORDER BY created_at ASC
    `).all(refundRequestId);
  }

  listPendingApprovals(filters = {}) {
    const { approver_level, page = 1, page_size = 50 } = filters;

    const conditions = ["status = 'pending'"];
    const params = [];

    if (approver_level) {
      conditions.push('approver_level = ?');
      params.push(approver_level);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM approval_requests ${whereClause}
    `);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * page_size;
    const queryStmt = this.db.prepare(`
      SELECT ar.id, ar.refund_request_id, ar.approver_level, ar.status, ar.created_at,
             rr.request_no, rr.order_id, rr.product_category, rr.amount, rr.initiator_id, rr.initiator_level
      FROM approval_requests ar
      JOIN refund_requests rr ON ar.refund_request_id = rr.id
      ${whereClause}
      ORDER BY ar.created_at ASC
      LIMIT ? OFFSET ?
    `);

    const records = queryStmt.all(...params, page_size, offset);

    return {
      records,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.ceil(total / page_size)
      }
    };
  }

  approve(approvalId, approver, comment = '') {
    const approval = this.getApprovalById(approvalId);
    if (!approval) {
      return { success: false, error: '审批请求不存在' };
    }

    if (approval.status !== 'pending') {
      return { 
        success: false, 
        error: '审批请求已处理',
        current_status: approval.status
      };
    }

    const refundRequest = refundService.getRefundRequestById(approval.refund_request_id);
    if (!refundRequest) {
      return { success: false, error: '关联的退款请求不存在' };
    }

    const approverStaff = permissionService.getStaffById(approver.id);
    if (!approverStaff) {
      return { success: false, error: '审批人不存在' };
    }

    const canApproveResult = permissionService.canApprove(
      approverStaff.level,
      refundRequest.initiator_level,
      refundRequest.amount,
      refundRequest.product_category
    );

    if (!canApproveResult.allowed) {
      auditService.log('OVERRIDE_ATTEMPT', approverStaff, 'approval_request', approvalId, 'blocked', {
        reason: canApproveResult.reason,
        refund_request_id: approval.refund_request_id,
        amount: refundRequest.amount
      });

      return {
        success: false,
        error: canApproveResult.reason,
        detail: canApproveResult
      };
    }

    const higherApprovalNeeded = this.checkHigherApprovalNeeded(
      approverStaff.level,
      refundRequest.amount,
      refundRequest.product_category
    );

    const now = Math.floor(Date.now() / 1000);

    try {
      const result = runTransaction(() => {
        this.db.prepare(`
          UPDATE approval_requests
          SET approver_id = ?, action = 'approve', comment = ?, status = 'approved', updated_at = ?
          WHERE id = ?
        `).run(approver.id, comment, now, approvalId);

        if (higherApprovalNeeded.needed) {
          const newApprovalId = uuidv4();
          this.db.prepare(`
            INSERT INTO approval_requests
            (id, refund_request_id, approver_level, status, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?)
          `).run(newApprovalId, approval.refund_request_id, higherApprovalNeeded.next_level, now, now);

          return { escalated: true, next_approval_id: newApprovalId, next_level: higherApprovalNeeded.next_level };
        } else {
          this.db.prepare(`
            UPDATE refund_requests
            SET status = 'approved', updated_at = ?
            WHERE id = ?
          `).run(now, approval.refund_request_id);

          return { escalated: false };
        }
      });

      auditService.log('APPROVAL_APPROVE', approverStaff, 'approval_request', approvalId, 'success', {
        refund_request_id: approval.refund_request_id,
        escalated: result.escalated,
        comment
      });

      logger.info('审批通过', {
        approval_id: approvalId,
        refund_request_id: approval.refund_request_id,
        approver_id: approver.id,
        escalated: result.escalated
      });

      return {
        success: true,
        escalated: result.escalated,
        next_approval_id: result.next_approval_id,
        next_approval_level: result.next_level,
        approval: this.getApprovalById(approvalId)
      };

    } catch (err) {
      logger.error('审批失败', { error: err.message, approval_id: approvalId });
      return { success: false, error: err.message };
    }
  }

  reject(approvalId, approver, comment = '') {
    const approval = this.getApprovalById(approvalId);
    if (!approval) {
      return { success: false, error: '审批请求不存在' };
    }

    if (approval.status !== 'pending') {
      return { 
        success: false, 
        error: '审批请求已处理',
        current_status: approval.status
      };
    }

    const approverStaff = permissionService.getStaffById(approver.id);
    if (!approverStaff) {
      return { success: false, error: '审批人不存在' };
    }

    const levelCheck = permissionService.isHigherOrEqualLevel(approverStaff.level, approval.approver_level);
    if (!levelCheck) {
      return {
        success: false,
        error: '审批人等级不足'
      };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      runTransaction(() => {
        this.db.prepare(`
          UPDATE approval_requests
          SET approver_id = ?, action = 'reject', comment = ?, status = 'rejected', updated_at = ?
          WHERE id = ?
        `).run(approver.id, comment, now, approvalId);

        this.db.prepare(`
          UPDATE refund_requests
          SET status = 'rejected', updated_at = ?
          WHERE id = ?
        `).run(now, approval.refund_request_id);

        this.db.prepare(`
          UPDATE approval_requests
          SET status = 'cancelled', updated_at = ?
          WHERE refund_request_id = ? AND status = 'pending'
        `).run(now, approval.refund_request_id);
      });

      auditService.log('APPROVAL_REJECT', approverStaff, 'approval_request', approvalId, 'success', {
        refund_request_id: approval.refund_request_id,
        comment
      });

      logger.info('审批拒绝', {
        approval_id: approvalId,
        refund_request_id: approval.refund_request_id,
        approver_id: approver.id
      });

      return {
        success: true,
        approval: this.getApprovalById(approvalId)
      };

    } catch (err) {
      logger.error('拒绝审批失败', { error: err.message, approval_id: approvalId });
      return { success: false, error: err.message };
    }
  }

  checkHigherApprovalNeeded(approverLevel, amount, category) {
    const currentLimit = permissionService.getRefundLimit(approverLevel, category);
    
    if (currentLimit.max_amount === null || amount <= currentLimit.max_amount) {
      return { needed: false };
    }

    const nextLevel = this.findNextApprovalLevel(approverLevel, amount, category);
    
    if (nextLevel) {
      return {
        needed: true,
        next_level: nextLevel
      };
    }

    return { needed: false };
  }

  findNextApprovalLevel(currentLevel, amount, category) {
    const hierarchy = permissionService.levelHierarchy;
    const currentIndex = hierarchy.indexOf(currentLevel);

    for (let i = currentIndex + 1; i < hierarchy.length; i++) {
      const level = hierarchy[i];
      const limit = permissionService.getRefundLimit(level, category);
      
      if (limit.max_amount === null || amount <= limit.max_amount) {
        return level;
      }
    }

    return null;
  }

  escalateApproval(approvalId, currentApprover, newLevel, reason = '') {
    const approval = this.getApprovalById(approvalId);
    if (!approval) {
      return { success: false, error: '审批请求不存在' };
    }

    if (approval.status !== 'pending') {
      return { 
        success: false, 
        error: '审批请求已处理',
        current_status: approval.status
      };
    }

    const approverStaff = permissionService.getStaffById(currentApprover.id);
    if (!approverStaff) {
      return { success: false, error: '审批人不存在' };
    }

    if (!permissionService.isHigherLevel(newLevel, approverStaff.level)) {
      return {
        success: false,
        error: '升级审批需要指定更高等级'
      };
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      const result = runTransaction(() => {
        this.db.prepare(`
          UPDATE approval_requests
          SET approver_id = ?, action = 'escalate', comment = ?, status = 'escalated', updated_at = ?
          WHERE id = ?
        `).run(currentApprover.id, reason, now, approvalId);

        const newApprovalId = uuidv4();
        this.db.prepare(`
          INSERT INTO approval_requests
          (id, refund_request_id, approver_level, status, created_at, updated_at)
          VALUES (?, ?, ?, 'pending', ?, ?)
        `).run(newApprovalId, approval.refund_request_id, newLevel, now, now);

        return newApprovalId;
      });

      auditService.log('APPROVAL_ESCALATE', approverStaff, 'approval_request', approvalId, 'success', {
        new_level: newLevel,
        reason
      });

      return {
        success: true,
        new_approval_id: result,
        new_approval_level: newLevel
      };

    } catch (err) {
      logger.error('升级审批失败', { error: err.message, approval_id: approvalId });
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ApprovalService();
