const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database').getDb;

const TransactionTypes = {
  ISSUE: 'issue',
  CONSUME: 'consume',
  REFUND: 'refund',
  FREEZE: 'freeze',
  UNFREEZE: 'unfreeze',
  EXPIRE: 'expire',
  ADJUST: 'adjust'
};

function checkIdempotent(key, service) {
  const row = db().prepare(
    'SELECT result FROM idempotent_keys WHERE idempotent_key = ? AND service = ?'
  ).get(key, service);
  return row ? JSON.parse(row.result) : null;
}

function saveIdempotent(key, service, result) {
  db().prepare(
    'INSERT OR IGNORE INTO idempotent_keys (idempotent_key, service, result) VALUES (?, ?, ?)'
  ).run(key, service, JSON.stringify(result));
}

function getMemberBalance(memberId) {
  const batches = db().prepare(
    `SELECT SUM(available_points) as available, 
            SUM(frozen_points) as frozen,
            SUM(consumed_points) as consumed,
            SUM(expired_points) as expired
     FROM point_batches 
     WHERE member_id = ? AND status = 'active'`
  ).get(memberId);

  return {
    available: batches.available || 0,
    frozen: batches.frozen || 0,
    consumed: batches.consumed || 0,
    expired: batches.expired || 0,
    total: (batches.available || 0) + (batches.frozen || 0) + (batches.consumed || 0) + (batches.expired || 0)
  };
}

function createLedgerRecord(memberId, type, ref, batchId, points, balanceBefore, balanceAfter, frozenBefore, frozenAfter, desc, operator = 'system') {
  const ledgerId = uuidv4();
  db().prepare(`
    INSERT INTO ledger_records 
    (ledger_id, member_id, transaction_type, transaction_ref, batch_id, points, 
     balance_before, balance_after, frozen_before, frozen_after, description, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ledgerId, memberId, type, ref, batchId, points, balanceBefore, balanceAfter, frozenBefore, frozenAfter, desc, operator);
  return ledgerId;
}

function issuePoints(memberId, points, sourceType, sourceRef, effectiveDate, expireDate, idempotentKey, operator = 'system') {
  if (idempotentKey) {
    const cached = checkIdempotent(idempotentKey, 'issue');
    if (cached) return { ...cached, idempotent: true };
  }

  return db().transaction(() => {
    const balance = getMemberBalance(memberId);
    const batchId = uuidv4();

    db().prepare(`
      INSERT INTO point_batches 
      (batch_id, member_id, total_points, available_points, source_type, source_ref, 
       effective_date, expire_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(batchId, memberId, points, points, sourceType, sourceRef, effectiveDate, expireDate, operator);

    createLedgerRecord(
      memberId, TransactionTypes.ISSUE, batchId, batchId, points,
      balance.available, balance.available + points,
      balance.frozen, balance.frozen,
      `${sourceType}发放积分`, operator
    );

    const result = {
      success: true,
      batchId,
      memberId,
      points,
      balance: {
        before: balance.available,
        after: balance.available + points
      }
    };

    if (idempotentKey) {
      saveIdempotent(idempotentKey, 'issue', result);
    }

    return result;
  })();
}

function consumePoints(memberId, points, orderNo, description, idempotentKey) {
  if (idempotentKey) {
    const cached = checkIdempotent(idempotentKey, 'consume');
    if (cached) return { ...cached, idempotent: true };
  }

  return db().transaction(() => {
    const balance = getMemberBalance(memberId);
    
    if (balance.available < points) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `可用积分不足，当前可用: ${balance.available}，需要: ${points}`,
        balance
      };
    }

    const batches = db().prepare(`
      SELECT batch_id, available_points, expire_date
      FROM point_batches
      WHERE member_id = ? AND status = 'active' AND available_points > 0
      ORDER BY expire_date ASC, created_at ASC
    `).all(memberId);

    let remaining = points;
    const batchItems = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      
      const deduct = Math.min(batch.available_points, remaining);
      batchItems.push({ batchId: batch.batch_id, points: deduct });
      
      db().prepare(`
        UPDATE point_batches 
        SET available_points = available_points - ?,
            consumed_points = consumed_points + ?
        WHERE batch_id = ?
      `).run(deduct, deduct, batch.batch_id);

      createLedgerRecord(
        memberId, TransactionTypes.CONSUME, orderNo, batch.batch_id, -deduct,
        balance.available, balance.available - deduct,
        balance.frozen, balance.frozen,
        description || '订单消费抵扣'
      );

      remaining -= deduct;
    }

    const consumeId = uuidv4();
    db().prepare(`
      INSERT INTO consume_records (consume_id, member_id, order_no, points, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(consumeId, memberId, orderNo, points, description);

    const insertItem = db().prepare(`
      INSERT INTO consume_batch_items (consume_id, batch_id, points)
      VALUES (?, ?, ?)
    `);

    batchItems.forEach(item => {
      insertItem.run(consumeId, item.batchId, item.points);
    });

    const result = {
      success: true,
      consumeId,
      memberId,
      orderNo,
      points,
      batchItems,
      balance: {
        before: balance.available,
        after: balance.available - points
      }
    };

    if (idempotentKey) {
      saveIdempotent(idempotentKey, 'consume', result);
    }

    return result;
  })();
}

function refundPoints(memberId, orderNo, points, description, idempotentKey) {
  if (idempotentKey) {
    const cached = checkIdempotent(idempotentKey, 'refund');
    if (cached) return { ...cached, idempotent: true };
  }

  return db().transaction(() => {
    const consume = db().prepare(`
      SELECT * FROM consume_records WHERE order_no = ? AND member_id = ?
    `).get(orderNo, memberId);

    if (!consume) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: `找不到消费订单: ${orderNo}`
      };
    }

    const batchItems = db().prepare(`
      SELECT cb.*, pb.expire_date
      FROM consume_batch_items cb
      JOIN point_batches pb ON cb.batch_id = pb.batch_id
      WHERE cb.consume_id = ?
      ORDER BY pb.expire_date ASC
    `).all(consume.consume_id);

    let totalRefundable = batchItems.reduce((sum, item) => sum + (item.points - item.refunded_points), 0);
    
    if (points > totalRefundable) {
      return {
        success: false,
        error: 'REFUND_EXCEEDED',
        message: `可退积分不足，可退: ${totalRefundable}，申请: ${points}`
      };
    }

    let remaining = points;
    const refundItems = [];
    const balance = getMemberBalance(memberId);

    for (const item of batchItems) {
      if (remaining <= 0) break;
      
      const refundable = item.points - item.refunded_points;
      if (refundable <= 0) continue;

      const refund = Math.min(refundable, remaining);
      refundItems.push({ batchId: item.batch_id, points: refund });

      db().prepare(`
        UPDATE point_batches 
        SET available_points = available_points + ?,
            consumed_points = consumed_points - ?
        WHERE batch_id = ?
      `).run(refund, refund, item.batch_id);

      db().prepare(`
        UPDATE consume_batch_items
        SET refunded_points = refunded_points + ?
        WHERE consume_id = ? AND batch_id = ?
      `).run(refund, consume.consume_id, item.batch_id);

      createLedgerRecord(
        memberId, TransactionTypes.REFUND, orderNo, item.batch_id, refund,
        balance.available, balance.available + refund,
        balance.frozen, balance.frozen,
        description || '订单退款回原批次'
      );

      remaining -= refund;
    }

    const refundId = uuidv4();
    db().prepare(`
      INSERT INTO refund_records (refund_id, member_id, order_no, consume_id, points, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(refundId, memberId, orderNo, consume.consume_id, points, description);

    const insertItem = db().prepare(`
      INSERT INTO refund_batch_items (refund_id, batch_id, points)
      VALUES (?, ?, ?)
    `);

    refundItems.forEach(item => {
      insertItem.run(refundId, item.batchId, item.points);
    });

    const result = {
      success: true,
      refundId,
      memberId,
      orderNo,
      points,
      refundItems,
      balance: {
        before: balance.available,
        after: balance.available + points
      }
    };

    if (idempotentKey) {
      saveIdempotent(idempotentKey, 'refund', result);
    }

    return result;
  })();
}

function freezePoints(memberId, points, freezeRef, reason, expireAt, idempotentKey) {
  if (idempotentKey) {
    const cached = checkIdempotent(idempotentKey, 'freeze');
    if (cached) return { ...cached, idempotent: true };
  }

  return db().transaction(() => {
    const balance = getMemberBalance(memberId);
    
    if (balance.available < points) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `可用积分不足，无法冻结`,
        balance
      };
    }

    const batches = db().prepare(`
      SELECT batch_id, available_points, expire_date
      FROM point_batches
      WHERE member_id = ? AND status = 'active' AND available_points > 0
      ORDER BY expire_date ASC, created_at ASC
    `).all(memberId);

    let remaining = points;
    const batchItems = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      
      const deduct = Math.min(batch.available_points, remaining);
      batchItems.push({ batchId: batch.batch_id, points: deduct });
      
      db().prepare(`
        UPDATE point_batches 
        SET available_points = available_points - ?,
            frozen_points = frozen_points + ?
        WHERE batch_id = ?
      `).run(deduct, deduct, batch.batch_id);

      remaining -= deduct;
    }

    const freezeId = uuidv4();
    db().prepare(`
      INSERT INTO freeze_records (freeze_id, member_id, freeze_ref, points, reason, expire_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(freezeId, memberId, freezeRef, points, reason, expireAt);

    const insertItem = db().prepare(`
      INSERT INTO freeze_batch_items (freeze_id, batch_id, points)
      VALUES (?, ?, ?)
    `);

    batchItems.forEach(item => {
      insertItem.run(freezeId, item.batchId, item.points);
    });

    createLedgerRecord(
      memberId, TransactionTypes.FREEZE, freezeRef, null, -points,
      balance.available, balance.available - points,
      balance.frozen, balance.frozen + points,
      reason || '冻结积分'
    );

    const result = {
      success: true,
      freezeId,
      memberId,
      freezeRef,
      points,
      batchItems,
      balance: {
        availableBefore: balance.available,
        availableAfter: balance.available - points,
        frozenBefore: balance.frozen,
        frozenAfter: balance.frozen + points
      }
    };

    if (idempotentKey) {
      saveIdempotent(idempotentKey, 'freeze', result);
    }

    return result;
  })();
}

function unfreezePoints(freezeId, idempotentKey) {
  if (idempotentKey) {
    const cached = checkIdempotent(idempotentKey, 'unfreeze');
    if (cached) return { ...cached, idempotent: true };
  }

  return db().transaction(() => {
    const freeze = db().prepare(`
      SELECT * FROM freeze_records WHERE freeze_id = ? AND status = 'frozen'
    `).get(freezeId);

    if (!freeze) {
      return {
        success: false,
        error: 'FREEZE_NOT_FOUND',
        message: '冻结记录不存在或已解冻'
      };
    }

    const balance = getMemberBalance(freeze.member_id);
    const items = db().prepare(`
      SELECT * FROM freeze_batch_items WHERE freeze_id = ?
    `).all(freezeId);

    for (const item of items) {
      db().prepare(`
        UPDATE point_batches 
        SET available_points = available_points + ?,
            frozen_points = frozen_points - ?
        WHERE batch_id = ?
      `).run(item.points, item.points, item.batch_id);
    }

    db().prepare(`
      UPDATE freeze_records 
      SET status = 'unfrozen', unfreeze_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE freeze_id = ?
    `).run(freezeId);

    createLedgerRecord(
      freeze.member_id, TransactionTypes.UNFREEZE, freeze.freeze_ref, null, freeze.points,
      balance.available, balance.available + freeze.points,
      balance.frozen, balance.frozen - freeze.points,
      '解冻积分'
    );

    const result = {
      success: true,
      freezeId,
      memberId: freeze.member_id,
      points: freeze.points,
      balance: {
        availableBefore: balance.available,
        availableAfter: balance.available + freeze.points,
        frozenBefore: balance.frozen,
        frozenAfter: balance.frozen - freeze.points
      }
    };

    if (idempotentKey) {
      saveIdempotent(idempotentKey, 'unfreeze', result);
    }

    return result;
  })();
}

function processExpire(executeDate, idempotentKey) {
  const taskKey = `expire_task_${executeDate}`;
  const cachedTask = checkIdempotent(taskKey, 'expire_task');
  if (cachedTask) {
    return { ...cachedTask, idempotent: true, message: '过期任务已执行，返回幂等结果' };
  }

  return db().transaction(() => {
    const existingTask = db().prepare(`
      SELECT * FROM expire_tasks WHERE execute_date = ?
    `).get(executeDate);

    if (existingTask && existingTask.status === 'completed') {
      const result = {
        success: true,
        taskId: existingTask.task_id,
        executeDate,
        totalMembers: existingTask.total_members,
        totalPoints: existingTask.total_points,
        idempotent: true,
        message: '过期任务已完成'
      };
      saveIdempotent(taskKey, 'expire_task', result);
      return result;
    }

    const taskId = uuidv4();
    
    if (existingTask) {
      db().prepare(`
        UPDATE expire_tasks 
        SET status = 'running', started_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run(existingTask.task_id);
    } else {
      db().prepare(`
        INSERT INTO expire_tasks (task_id, execute_date, status, started_at)
        VALUES (?, ?, 'running', CURRENT_TIMESTAMP)
      `).run(taskId, executeDate);
    }

    const expiringBatches = db().prepare(`
      SELECT * FROM point_batches
      WHERE status = 'active' 
        AND (available_points > 0 OR frozen_points > 0)
        AND expire_date <= ?
      ORDER BY expire_date ASC
    `).all(executeDate);

    let totalMembers = new Set();
    let totalPoints = 0;

    for (const batch of expiringBatches) {
      const balance = getMemberBalance(batch.member_id);
      const toExpire = batch.available_points + batch.frozen_points;
      
      if (toExpire <= 0) continue;

      db().prepare(`
        UPDATE point_batches 
        SET available_points = 0,
            frozen_points = 0,
            expired_points = expired_points + ?,
            status = 'expired'
        WHERE batch_id = ?
      `).run(toExpire, batch.batch_id);

      const expireId = uuidv4();
      db().prepare(`
        INSERT INTO expire_records (expire_id, member_id, batch_id, points, expire_date, task_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(expireId, batch.member_id, batch.batch_id, toExpire, batch.expire_date, taskId);

      createLedgerRecord(
        batch.member_id, TransactionTypes.EXPIRE, taskId, batch.batch_id, -toExpire,
        balance.available, balance.available - batch.available_points,
        balance.frozen, balance.frozen - batch.frozen_points,
        `积分批次过期: ${batch.batch_id}`
      );

      totalMembers.add(batch.member_id);
      totalPoints += toExpire;
    }

    db().prepare(`
      UPDATE expire_tasks 
      SET status = 'completed', 
          total_members = ?, 
          total_points = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `).run(totalMembers.size, totalPoints, taskId);

    const result = {
      success: true,
      taskId,
      executeDate,
      totalMembers: totalMembers.size,
      totalPoints,
      processedBatches: expiringBatches.length
    };

    saveIdempotent(taskKey, 'expire_task', result);
    return result;
  })();
}

function adjustPoints(memberId, batchId, newAvailable, reason, operator) {
  return db().transaction(() => {
    const batch = db().prepare(`
      SELECT * FROM point_batches WHERE batch_id = ? AND member_id = ?
    `).get(batchId, memberId);

    if (!batch) {
      return {
        success: false,
        error: 'BATCH_NOT_FOUND',
        message: '批次不存在'
      };
    }

    const balance = getMemberBalance(memberId);
    const oldAvailable = batch.available_points;
    const diff = newAvailable - oldAvailable;

    if (newAvailable < 0) {
      return {
        success: false,
        error: 'INVALID_POINTS',
        message: '可用积分不能为负数'
      };
    }

    db().prepare(`
      UPDATE point_batches 
      SET available_points = ?,
          total_points = total_points + ?
      WHERE batch_id = ?
    `).run(newAvailable, diff, batchId);

    const adjustId = uuidv4();
    const diffData = JSON.stringify({
      before: {
        available: oldAvailable,
        frozen: batch.frozen_points,
        consumed: batch.consumed_points,
        expired: batch.expired_points
      },
      after: {
        available: newAvailable,
        frozen: batch.frozen_points,
        consumed: batch.consumed_points,
        expired: batch.expired_points
      },
      diff: diff
    });

    db().prepare(`
      INSERT INTO adjustment_records 
      (adjust_id, member_id, batch_id, adjust_type, points_before, points_after, reason, operator, diff_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjustId, memberId, batchId, 'manual_adjust', oldAvailable, newAvailable, reason, operator, diffData);

    createLedgerRecord(
      memberId, TransactionTypes.ADJUST, adjustId, batchId, diff,
      balance.available, balance.available + diff,
      balance.frozen, balance.frozen,
      `人工修正: ${reason}`, operator
    );

    return {
      success: true,
      adjustId,
      batchId,
      memberId,
      operator,
      reason,
      diff: {
        before: oldAvailable,
        after: newAvailable,
        change: diff
      },
      balance: {
        before: balance.available,
        after: balance.available + diff
      }
    };
  })();
}

function getBatchDetails(memberId, batchId) {
  return db().prepare(`
    SELECT * FROM point_batches WHERE member_id = ? AND batch_id = ?
  `).get(memberId, batchId);
}

function getMemberBatches(memberId, status = null) {
  let sql = `SELECT * FROM point_batches WHERE member_id = ?`;
  const params = [memberId];
  
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY expire_date ASC`;

  return db().prepare(sql).all(...params);
}

function getExpiringSoon(memberId, days = 30) {
  const today = new Date();
  const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  
  return db().prepare(`
    SELECT * FROM point_batches 
    WHERE member_id = ? 
      AND status = 'active' 
      AND available_points > 0
      AND expire_date <= ?
      AND expire_date >= date('now')
    ORDER BY expire_date ASC
  `).all(memberId, futureDate.toISOString().split('T')[0]);
}

function getLedger(memberId, limit = 100) {
  return db().prepare(`
    SELECT * FROM ledger_records 
    WHERE member_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(memberId, limit);
}

function getMember(memberId) {
  return db().prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
}

function createMember(memberId, name, phone, level = '普通') {
  db().prepare(`
    INSERT OR IGNORE INTO members (member_id, name, phone, level)
    VALUES (?, ?, ?, ?)
  `).run(memberId, name, phone, level);
  
  return getMember(memberId);
}

function getAllMembers() {
  return db().prepare('SELECT * FROM members').all();
}

module.exports = {
  TransactionTypes,
  checkIdempotent,
  saveIdempotent,
  getMemberBalance,
  createLedgerRecord,
  issuePoints,
  consumePoints,
  refundPoints,
  freezePoints,
  unfreezePoints,
  processExpire,
  adjustPoints,
  getBatchDetails,
  getMemberBatches,
  getExpiringSoon,
  getLedger,
  getMember,
  createMember,
  getAllMembers
};
