const { getDb } = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class BalanceSnapshotRepository {
  create(data) {
    const db = getDb();
    const now = dayjs().valueOf();
    const id = uuid();
    try {
      const stmt = db.prepare(`
        INSERT INTO balance_snapshots 
        (id, member_id, snapshot_date, total_balance, freeze_balance, available_balance, ledger_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, data.memberId, data.snapshotDate,
        data.totalBalance, data.freezeBalance, data.availableBalance,
        data.ledgerCount, now
      );
      return this.findById(id);
    } catch (e) {
      if (e.message.includes('UNIQUE') || e.message.includes('unique')) {
        return this.findByMemberAndDate(data.memberId, data.snapshotDate);
      }
      throw e;
    }
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM balance_snapshots WHERE id = ?').get(id);
  }

  findByMemberAndDate(memberId, snapshotDate) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM balance_snapshots 
      WHERE member_id = ? AND snapshot_date = ?
    `).get(memberId, snapshotDate);
  }

  findByDate(snapshotDate) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM balance_snapshots 
      WHERE snapshot_date = ?
    `).all(snapshotDate);
  }
}

module.exports = new BalanceSnapshotRepository();
