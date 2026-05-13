const { getDb } = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class PointLedgerRepository {
  create(data) {
    const db = getDb();
    const now = dayjs().valueOf();
    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO point_ledgers 
      (id, member_id, trans_type, direction, amount,
       balance_before, balance_after,
       freeze_balance_before, freeze_balance_after,
       available_balance_before, available_balance_after,
       ref_id, ref_type, operator, operator_id, operator_type,
       reason, request_id, status, error_code, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.memberId, data.transType, data.direction, data.amount,
      data.balanceBefore, data.balanceAfter,
      data.freezeBalanceBefore, data.freezeBalanceAfter,
      data.availableBalanceBefore, data.availableBalanceAfter,
      data.refId, data.refType,
      data.operator, data.operatorId, data.operatorType,
      data.reason, data.requestId,
      data.status, data.errorCode, data.errorMessage, now
    );
    return this.findById(id);
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM point_ledgers WHERE id = ?').get(id);
  }

  findByMemberId(memberId, limit = 100) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE member_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(memberId, limit);
  }

  findByRequestId(requestId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE request_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(requestId);
  }

  countByMemberAndDate(memberId, date) {
    const db = getDb();
    const start = dayjs(date).startOf('day').valueOf();
    const end = dayjs(date).endOf('day').valueOf();
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM point_ledgers 
      WHERE member_id = ? AND created_at BETWEEN ? AND ?
    `).get(memberId, start, end);
    return row ? row.count : 0;
  }

  findByRefIdAndTransType(memberId, refId, transType) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE member_id = ? AND ref_id = ? AND trans_type = ?
      ORDER BY created_at DESC
    `).all(memberId, refId, transType);
  }

  findConsumptionByRefId(memberId, refId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE member_id = ? AND ref_id = ? 
        AND trans_type IN ('consume', 'consume_from_freeze')
        AND status = 'SUCCESS'
      ORDER BY created_at DESC
    `).get(memberId, refId);
  }

  findRefundsByRefId(memberId, refId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE member_id = ? AND ref_id = ? 
        AND trans_type = 'refund'
        AND status = 'SUCCESS'
      ORDER BY created_at DESC
    `).all(memberId, refId);
  }
}

module.exports = new PointLedgerRepository();
