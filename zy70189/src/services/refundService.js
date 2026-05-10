const { v4: uuidv4 } = require('uuid');
const { getConnection, runTransaction } = require('../database');
const logger = require('../logger');
const permissionService = require('./permissionService');
const auditService = require('./auditService');

const VALID_STATUSES = ['pending', 'awaiting_approval', 'approved', 'completed', 'rejected', 'cancelled', 'failed'];

class RefundService {
  constructor() {
    this.db = getConnection();
  }

  generateRequestNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RF${dateStr}${random}`;
  }

  validateRefundRequest(data) {
    const errors = [];
    const requiredFields = ['order_id', 'customer_id', 'product_id', 'product_category', 'amount', 'reason', 'initiator_id'];

    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`字段缺失: ${field}`);
      }
    });

    if (data.amount !== undefined) {
      if (typeof data.amount !== 'number' || isNaN(data.amount)) {
        errors.push('金额必须是数字');
      } else if (data.amount <= 0) {
        errors.push('金额必须大于0');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  checkDuplicateRequest(orderId, productId, initiatorId, windowMinutes = 5) {
    const startTime = Math.floor(Date.now() / 1000) - (windowMinutes * 60);
    
    const existing = this.db.prepare(`
      SELECT id, request_no, status, created_at
      FROM refund_requests
      WHERE order_id = ? 
        AND product_id = ? 
        AND initiator_id = ?
        AND created_at >= ?
        AND status NOT IN ('cancelled', 'rejected')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(orderId, productId, initiatorId, startTime);

    if (existing) {
      return {
        is_duplicate: true,
        existing_request: existing
      };
    }

    return { is_duplicate: false };
  }

  createRefundRequest(requestData) {
    const validation = this.validateRefundRequest(requestData);
    if (!validation.valid) {
      return {
        success: false,
        error: '参数验证失败',
        details: validation.errors
      };
    }

    const { order_id, customer_id, product_id, product_category, 
            amount, reason, initiator_id, idempotency_key } = requestData;

    if (idempotency_key) {
      const existingByKey = this.db.prepare(`
        SELECT id, request_no, status, created_at
        FROM refund_requests
        WHERE request_no = ?
      `).get(idempotency_key);

      if (existingByKey) {
        return {
          success: true,
          is_idempotent: true,
          refund_request: existingByKey
        };
      }
    }

    const staff = permissionService.getStaffById(initiator_id);
    if (!staff) {
      return {
        success: false,
        error: '发起人不存在'
      };
    }

    const duplicateCheck = this.checkDuplicateRequest(order_id, product_id, initiator_id);
    if (duplicateCheck.is_duplicate) {
      return {
        success: false,
        error: '重复请求',
        existing_request: duplicateCheck.existing_request
      };
    }

    const permissionResult = permissionService.checkPermission(staff, 'refund', amount, product_category);
    
    const overrideCheck = permissionService.detectOverrideAttempt(staff, staff.level, amount, product_category);
    if (overrideCheck.is_override) {
      auditService.log('OVERRIDE_ATTEMPT', staff, 'refund_request', null, 'blocked', {
        reason: overrideCheck.reason,
        required_approval_level: overrideCheck.required_approval_level,
        amount,
        category: product_category
      });
    }

    const requestId = uuidv4();
    const requestNo = idempotency_key || this.generateRequestNo();
    const now = Math.floor(Date.now() / 1000);

    let status = 'pending';
    let approvalRequestId = null;

    if (!permissionResult.allowed) {
      if (permissionResult.required_approval_level) {
        status = 'awaiting_approval';
      } else {
        return {
          success: false,
          error: permissionResult.reason,
          permission_checks: permissionResult.checks
        };
      }
    }

    try {
      const result = runTransaction(() => {
        this.db.prepare(`
          INSERT INTO refund_requests 
          (id, request_no, order_id, customer_id, product_id, product_category, 
           amount, currency, reason, initiator_id, initiator_level, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          requestId, requestNo, order_id, customer_id, product_id, product_category,
          amount, 'CNY', reason, initiator_id, staff.level, status, now, now
        );

        if (status === 'awaiting_approval') {
          approvalRequestId = uuidv4();
          this.db.prepare(`
            INSERT INTO approval_requests
            (id, refund_request_id, approver_level, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(approvalRequestId, requestId, permissionResult.required_approval_level, 'pending', now, now);
        }

        return true;
      });

      const newRequest = this.getRefundRequestById(requestId);

      auditService.log('REFUND_REQUEST_CREATE', staff, 'refund_request', requestId, 'success', {
        request_no: requestNo,
        amount,
        category: product_category,
        status,
        permission_checks: permissionResult.checks
      });

      logger.info('创建退款请求', {
        request_id: requestId,
        request_no: requestNo,
        initiator_id,
        amount,
        status,
        requires_approval: status === 'awaiting_approval'
      });

      return {
        success: true,
        refund_request: newRequest,
        approval_required: status === 'awaiting_approval',
        approval_request_id: approvalRequestId,
        required_approval_level: permissionResult.required_approval_level,
        permission_checks: permissionResult.checks
      };

    } catch (err) {
      logger.error('创建退款请求失败', { error: err.message, order_id, initiator_id });
      
      auditService.log('REFUND_REQUEST_CREATE', staff, 'refund_request', requestId, 'failed', {
        error: err.message,
        order_id,
        amount
      });

      return {
        success: false,
        error: '创建退款请求失败',
        detail: err.message
      };
    }
  }

  getRefundRequestById(requestId) {
    return this.db.prepare(`
      SELECT id, request_no, order_id, customer_id, product_id, product_category,
             amount, currency, reason, initiator_id, initiator_level, status,
             transaction_id, parent_request_id, created_at, updated_at
      FROM refund_requests
      WHERE id = ?
    `).get(requestId);
  }

  getRefundRequestByNo(requestNo) {
    return this.db.prepare(`
      SELECT id, request_no, order_id, customer_id, product_id, product_category,
             amount, currency, reason, initiator_id, initiator_level, status,
             transaction_id, parent_request_id, created_at, updated_at
      FROM refund_requests
      WHERE request_no = ?
    `).get(requestNo);
  }

  listRefundRequests(filters = {}) {
    const { status, initiator_id, product_category, order_id, 
            start_date, end_date, page = 1, page_size = 50 } = filters;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (initiator_id) {
      conditions.push('initiator_id = ?');
      params.push(initiator_id);
    }
    if (product_category) {
      conditions.push('product_category = ?');
      params.push(product_category);
    }
    if (order_id) {
      conditions.push('order_id = ?');
      params.push(order_id);
    }
    if (start_date) {
      conditions.push('created_at >= ?');
      params.push(Math.floor(new Date(start_date).getTime() / 1000));
    }
    if (end_date) {
      conditions.push('created_at <= ?');
      params.push(Math.floor(new Date(end_date).getTime() / 1000));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM refund_requests ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * page_size;
    const queryStmt = this.db.prepare(`
      SELECT id, request_no, order_id, customer_id, product_category, amount,
             initiator_id, initiator_level, status, created_at, updated_at
      FROM refund_requests
      ${whereClause}
      ORDER BY created_at DESC
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

  completeRefund(requestId, transactionId, operator) {
    const request = this.getRefundRequestById(requestId);
    if (!request) {
      return { success: false, error: '退款请求不存在' };
    }

    if (request.status !== 'approved') {
      return { 
        success: false, 
        error: '只能完成已批准的退款请求',
        current_status: request.status
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const beforeStatus = request.status;

    try {
      runTransaction(() => {
        this.db.prepare(`
          UPDATE refund_requests 
          SET status = ?, transaction_id = ?, updated_at = ?
          WHERE id = ?
        `).run('completed', transactionId, now, requestId);
      });

      auditService.log('REFUND_COMPLETE', operator, 'refund_request', requestId, 'success', 
        { transaction_id: transactionId },
        { status: beforeStatus },
        { status: 'completed' }
      );

      logger.info('退款完成', { request_id: requestId, transaction_id: transactionId });

      return {
        success: true,
        refund_request: this.getRefundRequestById(requestId)
      };

    } catch (err) {
      logger.error('完成退款失败', { error: err.message, request_id: requestId });
      return { success: false, error: err.message };
    }
  }

  cancelRefund(requestId, operator, reason) {
    const request = this.getRefundRequestById(requestId);
    if (!request) {
      return { success: false, error: '退款请求不存在' };
    }

    if (['completed', 'cancelled'].includes(request.status)) {
      return { 
        success: false, 
        error: '已完成或已取消的退款无法操作',
        current_status: request.status
      };
    }

    const beforeStatus = request.status;
    const now = Math.floor(Date.now() / 1000);

    try {
      runTransaction(() => {
        this.db.prepare(`
          UPDATE refund_requests 
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).run('cancelled', now, requestId);

        this.db.prepare(`
          UPDATE approval_requests
          SET status = ?, updated_at = ?
          WHERE refund_request_id = ? AND status = 'pending'
        `).run('cancelled', now, requestId);
      });

      auditService.log('REFUND_CANCEL', operator, 'refund_request', requestId, 'success',
        { cancel_reason: reason },
        { status: beforeStatus },
        { status: 'cancelled' }
      );

      return {
        success: true,
        refund_request: this.getRefundRequestById(requestId)
      };

    } catch (err) {
      logger.error('取消退款失败', { error: err.message, request_id: requestId });
      return { success: false, error: err.message };
    }
  }

  manualFixRefund(requestId, updates, operator) {
    const request = this.getRefundRequestById(requestId);
    if (!request) {
      return { success: false, error: '退款请求不存在' };
    }

    const allowedFields = ['status', 'amount', 'reason'];
    const validUpdates = {};
    const beforeValues = {};
    const afterValues = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'status' && !VALID_STATUSES.includes(updates[field])) {
          continue;
        }
        if (field === 'amount' && (typeof updates[field] !== 'number' || updates[field] <= 0)) {
          continue;
        }
        validUpdates[field] = updates[field];
        beforeValues[field] = request[field];
        afterValues[field] = updates[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return { success: false, error: '没有可更新的字段' };
    }

    const now = Math.floor(Date.now() / 1000);
    const setClauses = Object.keys(validUpdates).map(key => `${key} = ?`);
    const values = Object.values(validUpdates);
    values.push(now);
    values.push(requestId);

    try {
      this.db.prepare(`
        UPDATE refund_requests 
        SET ${setClauses.join(', ')}, updated_at = ?
        WHERE id = ?
      `).run(...values);

      auditService.log('REFUND_MANUAL_FIX', operator, 'refund_request', requestId, 'success',
        { note: '人工修正' },
        beforeValues,
        afterValues
      );

      logger.warn('人工修正退款请求', { 
        request_id: requestId, 
        operator_id: operator?.id,
        changes: validUpdates 
      });

      return {
        success: true,
        refund_request: this.getRefundRequestById(requestId)
      };

    } catch (err) {
      logger.error('人工修正失败', { error: err.message, request_id: requestId });
      return { success: false, error: err.message };
    }
  }
}

module.exports = new RefundService();
