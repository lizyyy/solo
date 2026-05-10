const { v4: uuidv4 } = require('uuid');
const { getDbSync } = require('../db/connection');
const {
  getDonationById,
  updateDonationStatus,
  canCreateTestResult
} = require('./donationService');

const TEST_TYPES = [
  'hiv',
  'htlv',
  'hbsag',
  'syphilis',
  'bacterial_culture',
  'cytomegalovirus'
];

const TEST_RESULTS = ['positive', 'negative', 'inconclusive'];
const TEST_STATUSES = ['pending', 'completed', 'cancelled'];

function createTestResult(donationId, testType, result, testDate, testedBy = null, notes = null) {
  if (!TEST_TYPES.includes(testType)) {
    throw new Error(`无效的检测类型: ${testType}。有效类型: ${TEST_TYPES.join(', ')}`);
  }

  if (!TEST_RESULTS.includes(result)) {
    throw new Error(`无效的检测结果: ${result}。有效结果: ${TEST_RESULTS.join(', ')}`);
  }

  if (!canCreateTestResult(donationId)) {
    throw new Error('只有处于 pending_test 状态的捐赠才能录入检测结果');
  }

  const db = getDbSync();
  
  const existing = db.prepare(
    'SELECT * FROM test_results WHERE donation_id = ? AND test_type = ? AND status = "completed"'
  ).get(donationId, testType);

  if (existing) {
    return {
      ...existing,
      _message: `该捐赠的 ${testType} 检测已存在，返回已有记录`
    };
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO test_results (id, donation_id, test_type, result, test_date, tested_by, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, donationId, testType, result, testDate, testedBy, 'completed', notes, now, now);

  evaluateDonationStatus(donationId);

  return getTestResultById(id);
}

function getTestResultById(id) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
}

function getTestResultsByDonation(donationId) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM test_results WHERE donation_id = ?').all(donationId);
}

function updateTestResult(id, updates) {
  const db = getDbSync();
  const test = getTestResultById(id);

  if (!test) {
    return null;
  }

  const allowedFields = ['result', 'test_date', 'tested_by', 'notes', 'status'];
  const fields = [];
  const values = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'result' && !TEST_RESULTS.includes(updates[field])) {
        throw new Error(`无效的检测结果: ${updates[field]}`);
      }
      if (field === 'status' && !TEST_STATUSES.includes(updates[field])) {
        throw new Error(`无效的状态: ${updates[field]}`);
      }
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) {
    return test;
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  db.prepare(`
    UPDATE test_results
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...values);

  evaluateDonationStatus(test.donation_id);

  return getTestResultById(id);
}

function evaluateDonationStatus(donationId) {
  const db = getDbSync();
  const donation = getDonationById(donationId);

  if (!donation || donation.status !== 'pending_test') {
    return;
  }

  const tests = db.prepare(
    'SELECT test_type, result FROM test_results WHERE donation_id = ? AND status = "completed"'
  ).all(donationId);

  if (tests.length === 0) {
    return;
  }

  const hasPositive = tests.some(t => t.result === 'positive');

  const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis'];
  const hasAllCritical = criticalTests.every(ct =>
    tests.some(t => t.test_type === ct)
  );

  const hasBacterial = tests.some(t => t.test_type === 'bacterial_culture');
  const bacterialTest = tests.find(t => t.test_type === 'bacterial_culture');
  const bacterialPositive = bacterialTest && bacterialTest.result === 'positive';

  if (hasPositive || bacterialPositive) {
    updateDonationStatus(donationId, 'test_failed', '检测不合格：存在阳性结果');
  } else if (hasAllCritical && hasBacterial) {
    updateDonationStatus(donationId, 'test_passed', '所有关键检测通过');
  }
}

function cancelTestResult(id, reason) {
  if (!reason) {
    throw new Error('取消检测必须提供原因');
  }

  const test = getTestResultById(id);
  if (!test) {
    return null;
  }

  return updateTestResult(id, {
    status: 'cancelled',
    notes: (test.notes ? test.notes + ' | ' : '') + `取消原因: ${reason}`
  });
}

module.exports = {
  TEST_TYPES,
  TEST_RESULTS,
  TEST_STATUSES,
  createTestResult,
  getTestResultById,
  getTestResultsByDonation,
  updateTestResult,
  cancelTestResult,
  evaluateDonationStatus
};
