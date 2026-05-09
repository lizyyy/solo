const db = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class PointLedgerRepository {
  create(data) {
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
    return db.prepare('SELECT * FROM point_ledgers WHERE id = ?').get(id);
  }

  findByMemberId(memberId, limit = 100) {
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE member_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(memberId, limit);
  }

  findByRequestId(requestId) {
    return db.prepare(`
      SELECT * FROM point_ledgers 
      WHERE request_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(requestId);
  }

  countByMemberAndDate(memberId, date) {
    const start = dayjs(date).startOf('day').valueOf();
    const end = dayjs(date).endOf('day').valueOf();
    return db.prepare(`
      SELECT COUNT(*) as count FROM point_ledgers 
      WHERE member_id = ? AND created_at BETWEEN ? AND ?
    `).get(memberId, start, end).count;
  }
}

module.exports = new PointLedgerRepository();
