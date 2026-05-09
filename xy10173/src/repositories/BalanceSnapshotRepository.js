const db = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class BalanceSnapshotRepository {
  create(data) {
    const now = dayjs().valueOf();
    const id = uuid();
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
  }

  findById(id) {
    return db.prepare('SELECT * FROM balance_snapshots WHERE id = ?').get(id);
  }

  findByMemberAndDate(memberId, snapshotDate) {
    return db.prepare(`
      SELECT * FROM balance_snapshots 
      WHERE member_id = ? AND snapshot_date = ?
    `).get(memberId, snapshotDate);
  }

  findByDate(snapshotDate) {
    return db.prepare(`
      SELECT * FROM balance_snapshots 
      WHERE snapshot_date = ?
    `).all(snapshotDate);
  }
}

module.exports = new BalanceSnapshotRepository();
