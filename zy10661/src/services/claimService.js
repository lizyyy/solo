const { run, get, all, generateId, now } = require('../db');

function createClaim(data) {
  const id = generateId();
  run(`
    INSERT INTO claims (
      id, claim_no, customer_name, customer_phone,
      policy_no, incident_type, incident_date,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.claim_no,
    data.customer_name,
    data.customer_phone || null,
    data.policy_no || null,
    data.incident_type || null,
    data.incident_date || null,
    now(),
    now()
  ]);
  return getClaimById(id);
}

function getClaimById(id) {
  return get('SELECT * FROM claims WHERE id = ?', [id]);
}

function getClaimByNo(claimNo) {
  return get('SELECT * FROM claims WHERE claim_no = ?', [claimNo]);
}

function listClaims(params = {}) {
  let sql = 'SELECT * FROM claims';
  const conditions = [];
  const values = [];

  if (params.customer_name) {
    conditions.push('customer_name LIKE ?');
    values.push(`%${params.customer_name}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  return all(sql, values);
}

module.exports = {
  createClaim,
  getClaimById,
  getClaimByNo,
  listClaims
};
