const database = require('../database');
const { generateId, now, RESPONSIBILITIES, lockManager, AuditLog } = require('../utils');

class LiabilityService {
  freezeLiability(repairOrderId, responsibility, reason, operator = 'system') {
    if (!RESPONSIBILITIES.includes(responsibility)) {
      throw new Error(`责任方必须是: ${RESPONSIBILITIES.join(', ')}`);
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

        const existingActiveFreeze = database.prepare(`
          SELECT * FROM liability_freezes 
          WHERE repair_order_id = ? AND is_active = 1
        `).get(repairOrderId);

        if (existingActiveFreeze) {
          if (existingActiveFreeze.responsibility === responsibility) {
            throw new Error('该责任方已经是当前冻结责任方');
          }
          database.prepare(`
            UPDATE liability_freezes 
            SET is_active = 0 
            WHERE id = ?
          `).run(existingActiveFreeze.id);
        }

        const freezeId = generateId();
        const nowTime = now();

        database.prepare(`
          INSERT INTO liability_freezes 
          (id, repair_order_id, responsibility, reason, frozen_at, frozen_by, is_active, version)
          VALUES (?, ?, ?, ?, ?, ?, 1, 1)
        `).run(freezeId, repairOrderId, responsibility, reason || null, nowTime, operator);

        database.prepare(`
          UPDATE repair_orders 
          SET current_responsibility = ?, status = 'FREEZED', updated_at = ?, version = version + 1
          WHERE id = ?
        `).run(responsibility, nowTime, repairOrderId);

        AuditLog.log('LIABILITY', 'FREEZE', repairOrderId, operator, {
          freeze_id: freezeId,
          responsibility,
          reason
        });

        return {
          freeze_id: freezeId,
          repair_order_id: repairOrderId,
          responsibility,
          frozen_at: nowTime,
          previous_freeze: existingActiveFreeze ? {
            id: existingActiveFreeze.id,
            responsibility: existingActiveFreeze.responsibility
          } : null
        };
      });
    } finally {
      lockManager.release(lockKey, lockHolder);
    }
  }

  unfreezeLiability(repairOrderId, operator = 'system') {
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

        if (!activeFreeze) {
          throw new Error('该返修单当前没有活动的责任冻结');
        }

        database.prepare(`
          UPDATE liability_freezes 
          SET is_active = 0 
          WHERE id = ?
        `).run(activeFreeze.id);

        database.prepare(`
          UPDATE repair_orders 
          SET current_responsibility = NULL, status = 'PROCESSING', updated_at = ?, version = version + 1
          WHERE id = ?
        `).run(now(), repairOrderId);

        AuditLog.log('LIABILITY', 'UNFREEZE', repairOrderId, operator, {
          unfrozen_freeze_id: activeFreeze.id,
          unfrozen_responsibility: activeFreeze.responsibility
        });

        return {
          success: true,
          message: '责任冻结已解除',
          unfrozen_responsibility: activeFreeze.responsibility
        };
      });
    } finally {
      lockManager.release(lockKey, lockHolder);
    }
  }

  getActiveFreeze(repairOrderId) {
    return database.prepare(`
      SELECT * FROM liability_freezes 
      WHERE repair_order_id = ? AND is_active = 1
    `).get(repairOrderId);
  }

  getFreezeHistory(repairOrderId) {
    return database.prepare(`
      SELECT * FROM liability_freezes 
      WHERE repair_order_id = ? 
      ORDER BY frozen_at DESC
    `).all(repairOrderId);
  }
}

module.exports = new LiabilityService();
