const database = require('../database');
const { generateId, now, RESPONSIBILITIES, lockManager, AuditLog } = require('../utils');

class RejudgeService {
  submitRejudge(repairOrderId, newResponsibility, reason, operator = 'system') {
    if (!RESPONSIBILITIES.includes(newResponsibility)) {
      throw new Error(`责任方必须是: ${RESPONSIBILITIES.join(', ')}`);
    }
    if (!reason) {
      throw new Error('复判原因不能为空');
    }

    const lockKey = `order:${repairOrderId}`;
    const lockHolder = generateId();

    const lockResult = lockManager.acquire(lockKey, lockHolder, 10000);
    if (!lockResult.success) {
      throw new Error('返修单正在被其他操作处理，请稍后重试');
    }

    try {
      return database.runTransaction(() => {
        const order = database.prepare('SELECT * FROM repair_orders WHERE id = ?').get(repairOrderId);
        if (!order) {
          throw new Error('返修单不存在');
        }

        const activeFreeze = database.prepare(`
          SELECT * FROM liability_freezes 
          WHERE repair_order_id = ? AND is_active = 1
        `).get(repairOrderId);

        if (activeFreeze && activeFreeze.responsibility === newResponsibility) {
          throw new Error('新责任方与当前责任方相同');
        }

        const pendingRejudge = database.prepare(`
          SELECT * FROM rejudge_records 
          WHERE repair_order_id = ? AND status = 'PENDING'
        `).get(repairOrderId);

        if (pendingRejudge) {
          throw new Error('该返修单已有待审批的复判申请');
        }

        const id = generateId();
        const nowTime = now();

        database.prepare(`
          INSERT INTO rejudge_records 
          (id, repair_order_id, previous_responsibility, new_responsibility, reason, operator, operated_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).run(id, repairOrderId, activeFreeze ? activeFreeze.responsibility : null, newResponsibility, reason, operator, nowTime);

        database.prepare(`
          UPDATE repair_orders 
          SET status = 'REJUDGING', updated_at = ?, version = version + 1
          WHERE id = ?
        `).run(nowTime, repairOrderId);

        AuditLog.log('REJUDGE', 'SUBMIT', repairOrderId, operator, {
          rejudge_id: id,
          previous_responsibility: activeFreeze ? activeFreeze.responsibility : null,
          new_responsibility: newResponsibility,
          reason
        });

        return {
          id,
          repair_order_id: repairOrderId,
          previous_responsibility: activeFreeze ? activeFreeze.responsibility : null,
          new_responsibility: newResponsibility,
          reason,
          status: 'PENDING',
          operated_at: nowTime
        };
      });
    } finally {
      lockManager.release(lockKey, lockHolder);
    }
  }

  approveRejudge(rejudgeId, comment, approver = 'system') {
    const lockHolder = generateId();

    return database.runTransaction(() => {
      const rejudge = database.prepare('SELECT * FROM rejudge_records WHERE id = ?').get(rejudgeId);
      if (!rejudge) {
        throw new Error('复判记录不存在');
      }
      if (rejudge.status !== 'PENDING') {
        throw new Error('该复判申请已处理');
      }

      const lockKey = `order:${rejudge.repair_order_id}`;
      const lockResult = lockManager.acquire(lockKey, lockHolder, 10000);
      if (!lockResult.success) {
        throw new Error('返修单正在被其他操作处理，请稍后重试');
      }

      try {
        const nowTime = now();

        database.prepare(`
          UPDATE rejudge_records 
          SET status = 'APPROVED', approver = ?, approved_at = ?, approve_comment = ?
          WHERE id = ?
        `).run(approver, nowTime, comment || null, rejudgeId);

        const existingActive = database.prepare(`
          SELECT * FROM liability_freezes 
          WHERE repair_order_id = ? AND is_active = 1
        `).get(rejudge.repair_order_id);

        if (existingActive) {
          database.prepare(`
            UPDATE liability_freezes 
            SET is_active = 0 
            WHERE id = ?
          `).run(existingActive.id);
        }

        const freezeId = generateId();
        database.prepare(`
          INSERT INTO liability_freezes 
          (id, repair_order_id, responsibility, reason, frozen_at, frozen_by, is_active, version)
          VALUES (?, ?, ?, ?, ?, ?, 1, 1)
        `).run(freezeId, rejudge.repair_order_id, rejudge.new_responsibility, `复判通过: ${comment || '通过'}`, nowTime, approver);

        database.prepare(`
          UPDATE repair_orders 
          SET current_responsibility = ?, status = 'FREEZED', updated_at = ?, version = version + 1
          WHERE id = ?
        `).run(rejudge.new_responsibility, nowTime, rejudge.repair_order_id);

        AuditLog.log('REJUDGE', 'APPROVE', rejudge.repair_order_id, approver, {
          rejudge_id: rejudgeId,
          new_responsibility: rejudge.new_responsibility,
          comment
        });

        return {
          success: true,
          message: '复判已通过，责任已切换',
          new_responsibility: rejudge.new_responsibility
        };
      } finally {
        lockManager.release(lockKey, lockHolder);
      }
    });
  }

  rejectRejudge(rejudgeId, comment, approver = 'system') {
    const lockHolder = generateId();

    return database.runTransaction(() => {
      const rejudge = database.prepare('SELECT * FROM rejudge_records WHERE id = ?').get(rejudgeId);
      if (!rejudge) {
        throw new Error('复判记录不存在');
      }
      if (rejudge.status !== 'PENDING') {
        throw new Error('该复判申请已处理');
      }

      const lockKey = `order:${rejudge.repair_order_id}`;
      const lockResult = lockManager.acquire(lockKey, lockHolder, 10000);
      if (!lockResult.success) {
        throw new Error('返修单正在被其他操作处理，请稍后重试');
      }

      try {
        const nowTime = now();

        database.prepare(`
          UPDATE rejudge_records 
          SET status = 'REJECTED', approver = ?, approved_at = ?, approve_comment = ?
          WHERE id = ?
        `).run(approver, nowTime, comment || null, rejudgeId);

        const activeFreeze = database.prepare(`
          SELECT * FROM liability_freezes 
          WHERE repair_order_id = ? AND is_active = 1
        `).get(rejudge.repair_order_id);

        const newStatus = activeFreeze ? 'FREEZED' : 'PROCESSING';
        database.prepare(`
          UPDATE repair_orders 
          SET status = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `).run(newStatus, nowTime, rejudge.repair_order_id);

        AuditLog.log('REJUDGE', 'REJECT', rejudge.repair_order_id, approver, {
          rejudge_id: rejudgeId,
          comment
        });

        return {
          success: true,
          message: '复判已驳回',
          current_responsibility: activeFreeze ? activeFreeze.responsibility : null
        };
      } finally {
        lockManager.release(lockKey, lockHolder);
      }
    });
  }

  listRejudges(filter = {}) {
    let sql = 'SELECT * FROM rejudge_records WHERE 1=1';
    const params = [];

    if (filter.repair_order_id) {
      sql += ' AND repair_order_id = ?';
      params.push(filter.repair_order_id);
    }
    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.new_responsibility) {
      sql += ' AND new_responsibility = ?';
      params.push(filter.new_responsibility);
    }

    sql += ' ORDER BY operated_at DESC';
    let results = database.prepare(sql).all(...params);
    
    const offset = filter.offset || 0;
    const limit = filter.limit || 20;
    return results.slice(offset, offset + limit);
  }

  getRejudge(id) {
    return database.prepare('SELECT * FROM rejudge_records WHERE id = ?').get(id);
  }
}

module.exports = new RejudgeService();
