const { v4: uuidv4 } = require('uuid');
const { getDbSync } = require('../db/connection');

const DONATION_STATUSES = ['pending_test', 'test_passed', 'test_failed', 'frozen', 'distributed', 'recalled', 'withdrawn'];

function createDonation(donorId, donationDate, quantityMl, notes = null) {
  const db = getDbSync();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO donations (id, donor_id, donation_date, quantity_ml, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, donorId, donationDate, quantityMl, 'pending_test', notes, now, now);

  return getDonationById(id);
}

function getDonationById(id) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
}

function getAllDonations(filters = {}) {
  const db = getDbSync();
  let sql = 'SELECT * FROM donations WHERE 1=1';
  const params = [];

  if (filters.donorId) {
    sql += ' AND donor_id = ?';
    params.push(filters.donorId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}

function updateDonationStatus(id, newStatus, reason = null) {
  if (!DONATION_STATUSES.includes(newStatus)) {
    throw new Error(`无效的状态: ${newStatus}。有效状态: ${DONATION_STATUSES.join(', ')}`);
  }

  const db = getDbSync();
  const donation = getDonationById(id);

  if (!donation) {
    return null;
  }

  if (donation.status === newStatus) {
    return {
      ...donation,
      _message: `状态已是 ${newStatus}，无需更新`
    };
  }

  if (!canTransitionStatus(donation.status, newStatus)) {
    throw new Error(`无法从 ${donation.status} 转换到 ${newStatus}`);
  }

  const now = new Date().toISOString();
  const newNotes = reason
    ? (donation.notes ? donation.notes + ' | ' : '') + reason
    : donation.notes;

  db.prepare(`
    UPDATE donations
    SET status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, newNotes, now, id);

  return getDonationById(id);
}

function canTransitionStatus(current, next) {
  const transitions = {
    'pending_test': ['test_passed', 'test_failed', 'withdrawn'],
    'test_passed': ['frozen', 'withdrawn'],
    'test_failed': ['withdrawn'],
    'frozen': ['distributed', 'recalled', 'withdrawn'],
    'distributed': ['recalled'],
    'recalled': [],
    'withdrawn': []
  };

  return transitions[current]?.includes(next) || false;
}

function withdrawDonation(id, reason) {
  if (!reason) {
    throw new Error('撤回必须提供原因');
  }
  return updateDonationStatus(id, 'withdrawn', `撤回原因: ${reason}`);
}

function getDonationWithDetails(id) {
  const db = getDbSync();
  const donation = getDonationById(id);

  if (!donation) {
    return null;
  }

  const tests = db.prepare('SELECT * FROM test_results WHERE donation_id = ?').all(id);
  const batches = db.prepare('SELECT * FROM frozen_batches WHERE donation_id = ?').all(id);

  return {
    ...donation,
    test_results: tests,
    frozen_batches: batches
  };
}

function canCreateTestResult(donationId) {
  const donation = getDonationById(donationId);
  return donation && donation.status === 'pending_test';
}

function canFreezeDonation(donationId) {
  const db = getDbSync();
  const donation = getDonationById(donationId);

  if (!donation || donation.status !== 'test_passed') {
    return false;
  }

  const requiredTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
  const testResults = db.prepare(
    'SELECT test_type, result FROM test_results WHERE donation_id = ? AND status = "completed"'
  ).all(donationId);

  const testMap = {};
  testResults.forEach(t => {
    testMap[t.test_type] = t.result;
  });

  for (const testType of requiredTests) {
    if (!testMap[testType] || testMap[testType] !== 'negative') {
      return false;
    }
  }

  return true;
}

function getFrozenVolumeUsed(donationId) {
  const db = getDbSync();
  const result = db.prepare(`
    SELECT SUM(volume_ml) as total
    FROM frozen_batches
    WHERE donation_id = ?
  `).get(donationId);
  return result && result.total !== null ? result.total : 0;
}

function isDonationFullyFrozen(donationId) {
  const donation = getDonationById(donationId);
  if (!donation) return false;

  const frozen = getFrozenVolumeUsed(donationId);
  return frozen >= donation.quantity_ml;
}

module.exports = {
  DONATION_STATUSES,
  createDonation,
  getDonationById,
  getAllDonations,
  updateDonationStatus,
  withdrawDonation,
  getDonationWithDetails,
  canCreateTestResult,
  canFreezeDonation,
  getFrozenVolumeUsed,
  isDonationFullyFrozen
};
