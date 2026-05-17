const { STATUS, STATUS_FLOW, OPERATION_SOURCE, UNLOCK_REASON } = require('../models/constants');

class ReplayService {
  constructor(store) {
    this.store = store;
  }

  validateStatusTransition(currentStatus, nextStatus) {
    const allowedTransitions = STATUS_FLOW[currentStatus] || [];
    return allowedTransitions.includes(nextStatus);
  }

  addHistory(replayId, operation) {
    return this.store.create('history', {
      replayId,
      source: operation.source || OPERATION_SOURCE.API,
      operator: operation.operator || 'system',
      action: operation.action,
      previousStatus: operation.previousStatus,
      newStatus: operation.newStatus,
      reason: operation.reason,
      timestamp: new Date().toISOString(),
      details: operation.details || {}
    });
  }

  createReplayPermission(data) {
    const { orderId, sessionId, studentId, studentName, reason, operator, source } = data;

    const order = this.store.getById('orders', orderId);
    const session = this.store.getById('liveSessions', sessionId);

    if (!order) {
      throw new Error('订单不存在');
    }
    if (!session) {
      throw new Error('直播场次不存在');
    }

    const existing = this.store.findOne('replayPermissions', 
      p => p.orderId === orderId && p.sessionId === sessionId && p.status !== STATUS.REVOKED
    );

    if (existing) {
      throw new Error('该订单对应直播的回放权限已存在，请勿重复申请');
    }

    const permission = this.store.create('replayPermissions', {
      orderId,
      sessionId,
      studentId,
      studentName,
      orderNumber: order.orderNumber,
      sessionTitle: session.title,
      reason: reason || UNLOCK_REASON.OTHER,
      status: STATUS.PENDING_VERIFICATION,
      isRefundedStudent: order.isRefunded || false,
      refundDetails: order.isRefunded ? {
        refundDate: order.refundDate,
        keepAccessReason: '退款学员通过旧链接观看'
      } : null,
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    this.addHistory(permission.id, {
      source: source || OPERATION_SOURCE.API,
      operator: operator || 'system',
      action: '创建回放解锁申请',
      previousStatus: null,
      newStatus: STATUS.PENDING_VERIFICATION,
      reason: reason,
      details: { orderNumber: order.orderNumber, sessionTitle: session.title }
    });

    return permission;
  }

  verifyAndUnlock(replayId, operator, source = OPERATION_SOURCE.MANUAL) {
    const permission = this.store.getById('replayPermissions', replayId);
    if (!permission) {
      throw new Error('回放权限不存在');
    }

    if (permission.status !== STATUS.PENDING_VERIFICATION) {
      throw new Error(`当前状态为"${permission.status}"，无法执行核验解锁操作`);
    }

    if (!this.validateStatusTransition(permission.status, STATUS.UNLOCKED)) {
      throw new Error('状态流转不合法');
    }

    const updated = this.store.update('replayPermissions', replayId, {
      status: STATUS.UNLOCKED,
      unlockedAt: new Date().toISOString(),
      unlockedBy: operator
    });

    this.addHistory(replayId, {
      source,
      operator,
      action: '核验通过并解锁回放',
      previousStatus: STATUS.PENDING_VERIFICATION,
      newStatus: STATUS.UNLOCKED,
      details: { unlockedAt: new Date().toISOString() }
    });

    return updated;
  }

  revokePermission(replayId, operator, reason, source = OPERATION_SOURCE.MANUAL) {
    const permission = this.store.getById('replayPermissions', replayId);
    if (!permission) {
      throw new Error('回放权限不存在');
    }

    if (!this.validateStatusTransition(permission.status, STATUS.REVOKED)) {
      throw new Error(`当前状态为"${permission.status}"，无法撤销`);
    }

    const previousStatus = permission.status;
    const updated = this.store.update('replayPermissions', replayId, {
      status: STATUS.REVOKED,
      revokedAt: new Date().toISOString(),
      revokedBy: operator,
      revokeReason: reason
    });

    this.addHistory(replayId, {
      source,
      operator,
      action: '撤销回放权限',
      previousStatus,
      newStatus: STATUS.REVOKED,
      reason,
      details: { revokedAt: new Date().toISOString() }
    });

    return updated;
  }

  expirePermission(replayId, operator = 'system') {
    const permission = this.store.getById('replayPermissions', replayId);
    if (!permission) {
      throw new Error('回放权限不存在');
    }

    if (!this.validateStatusTransition(permission.status, STATUS.EXPIRED)) {
      throw new Error(`当前状态为"${permission.status}"，无法标记过期`);
    }

    const updated = this.store.update('replayPermissions', replayId, {
      status: STATUS.EXPIRED,
      expiredAt: new Date().toISOString()
    });

    this.addHistory(replayId, {
      source: OPERATION_SOURCE.SYSTEM,
      operator,
      action: '回放权限自然过期',
      previousStatus: STATUS.UNLOCKED,
      newStatus: STATUS.EXPIRED,
      details: { expiredAt: new Date().toISOString() }
    });

    return updated;
  }

  getPermissionList(filters = {}) {
    let permissions = this.store.getAll('replayPermissions');

    if (filters.status) {
      permissions = permissions.filter(p => p.status === filters.status);
    }
    if (filters.studentId) {
      permissions = permissions.filter(p => p.studentId === filters.studentId);
    }
    if (filters.isRefundedStudent) {
      permissions = permissions.filter(p => p.isRefundedStudent === true);
    }

    return permissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getPermissionDetail(replayId) {
    const permission = this.store.getById('replayPermissions', replayId);
    if (!permission) {
      return null;
    }

    const history = this.store.find('history', h => h.replayId === replayId);
    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      ...permission,
      history: sortedHistory
    };
  }

  getHistory(replayId) {
    const history = this.store.find('history', h => h.replayId === replayId);
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  batchImport(records, operator) {
    const results = {
      success: [],
      failed: [],
      badRecords: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;

      try {
        if (!record.orderId || !record.sessionId || !record.studentId) {
          throw new Error('必填字段缺失');
        }

        const permission = this.createReplayPermission({
          ...record,
          operator,
          source: OPERATION_SOURCE.IMPORT
        });

        results.success.push({
          rowNumber,
          permissionId: permission.id,
          orderNumber: permission.orderNumber,
          status: permission.status
        });
      } catch (error) {
        const badRecord = {
          rowNumber,
          data: record,
          error: error.message,
          importedAt: new Date().toISOString(),
          importedBy: operator
        };

        this.store.create('badRecords', badRecord);
        results.badRecords.push(badRecord);
        results.failed.push({ rowNumber, error: error.message });
      }
    }

    return results;
  }

  createConflictRecord(data) {
    const first = this.createReplayPermission(data);
    try {
      this.createReplayPermission(data);
    } catch (e) {
      return {
        originalPermission: first,
        conflictError: e.message
      };
    }
    return { originalPermission: first, conflictError: null };
  }

  createOrder(data) {
    return this.store.create('orders', {
      orderNumber: data.orderNumber || `ORD${Date.now()}`,
      studentId: data.studentId,
      studentName: data.studentName,
      courseId: data.courseId,
      courseName: data.courseName,
      amount: data.amount,
      purchaseDate: data.purchaseDate || new Date().toISOString(),
      isRefunded: data.isRefunded || false,
      refundDate: data.refundDate,
      status: data.isRefunded ? '已退款' : '有效'
    });
  }

  createLiveSession(data) {
    return this.store.create('liveSessions', {
      title: data.title,
      courseId: data.courseId,
      courseName: data.courseName,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      replayUrl: data.replayUrl
    });
  }
}

module.exports = ReplayService;
