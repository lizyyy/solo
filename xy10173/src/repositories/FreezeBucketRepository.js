const { getDb } = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class FreezeBucketRepository {
  create(data) {
    const db = getDb();
    const now = dayjs().valueOf();
    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO freeze_buckets 
      (id, member_id, amount, frozen_amount, used_amount, released_amount,
       reason, operator, operator_id, operator_type, freeze_rule_id,
       status, frozen_at, expected_release_at, released_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.memberId, data.amount, data.frozenAmount || 0, 0, 0,
      data.reason, data.operator, data.operatorId, data.operatorType, data.freezeRuleId,
      data.status, data.frozenAt, data.expectedReleaseAt, null, now, now
    );
    return this.findById(id);
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM freeze_buckets WHERE id = ?').get(id);
  }

  findByMemberId(memberId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM freeze_buckets 
      WHERE member_id = ? 
      ORDER BY created_at DESC
    `).all(memberId);
  }

  findActiveByMemberId(memberId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM freeze_buckets 
      WHERE member_id = ? AND status IN ('ACTIVE', 'PARTIAL')
      ORDER BY frozen_at ASC
    `).all(memberId);
  }

  findByMemberAndDateBefore(memberId, date) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM freeze_buckets 
      WHERE member_id = ? 
        AND status IN ('ACTIVE', 'PARTIAL')
        AND expected_release_at <= ?
      ORDER BY expected_release_at ASC
    `).all(memberId, date.valueOf());
  }

  update(id, data) {
    const db = getDb();
    const now = dayjs().valueOf();
    const fields = [];
    const values = [];
    
    if (data.usedAmount !== undefined) {
      fields.push('used_amount = ?');
      values.push(data.usedAmount);
    }
    if (data.releasedAmount !== undefined) {
      fields.push('released_amount = ?');
      values.push(data.releasedAmount);
    }
    if (data.frozenAmount !== undefined) {
      fields.push('frozen_amount = ?');
      values.push(data.frozenAmount);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.releasedAt !== undefined) {
      fields.push('released_at = ?');
      values.push(data.releasedAt);
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    const stmt = db.prepare(`UPDATE freeze_buckets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }
}

module.exports = new FreezeBucketRepository();
