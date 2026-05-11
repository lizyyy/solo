const db = require('./database');

function getPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}Q${quarter}`;
}

function getAllTiers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM tiers ORDER BY min_points ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function calculateTier(points, tiers) {
  let currentTier = tiers[0];
  for (const tier of tiers) {
    if (points >= tier.min_points) {
      currentTier = tier;
    }
  }
  return currentTier.name;
}

function getMemberPointsInPeriod(memberId, period) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COALESCE(SUM(points), 0) as total_points 
       FROM transactions 
       WHERE member_id = ? AND period = ? AND status = 'valid'`,
      [memberId, period],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.total_points);
      }
    );
  });
}

function getAllMembers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM members', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getSettlementRun(period) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM settlement_runs 
       WHERE period = ? AND status IN ('completed', 'running')
       ORDER BY started_at DESC 
       LIMIT 1`,
      [period],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getMemberSettlement(memberId, period) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM settlements WHERE member_id = ? AND period = ?',
      [memberId, period],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getMemberById(memberId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

module.exports = {
  getPeriod,
  getAllTiers,
  calculateTier,
  getMemberPointsInPeriod,
  getAllMembers,
  getSettlementRun,
  getMemberSettlement,
  getMemberById
};
