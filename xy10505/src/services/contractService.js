const db = require('../database');
const { generateId } = require('../utils');
const config = require('../config');

function createContract(data) {
  if (!data.name || !data.category || data.amount == null || !data.partyA || !data.partyB) {
    throw new Error('合同缺少必要字段：名称、类型、金额、甲方、乙方');
  }

  if (!config.contractCategories[data.category]) {
    throw new Error(`无效的合同类型: ${data.category}`);
  }

  const id = generateId();
  const contractNo = data.contractNo || `HT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  db.runExec(`
    INSERT INTO contracts (id, contract_no, name, category, amount, amount_currency, party_a, party_b)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, contractNo, data.name, data.category, data.amount, data.currency || 'CNY', data.partyA, data.partyB]);

  return getContractById(id);
}

function updateContract(id, data, operator) {
  const existing = getContractById(id);
  
  if (!existing) {
    throw new Error(`合同不存在: ${id}`);
  }

  const updates = [];
  const values = [];
  const fieldChanges = [];

  const fieldMap = {
    name: 'name',
    category: 'category',
    amount: 'amount',
    currency: 'amount_currency',
    partyA: 'party_a',
    partyB: 'party_b',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined && data[key] !== existing[dbField]) {
      updates.push(`${dbField} = ?`);
      values.push(data[key]);
      fieldChanges.push({
        field: dbField,
        oldValue: existing[dbField],
        newValue: data[key],
      });
    }
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.runExec(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`, ...values);

  return getContractById(id);
}

function getContractById(id) {
  return db.runGet('SELECT * FROM contracts WHERE id = ?', [id]);
}

function getContractByNo(contractNo) {
  return db.runGet('SELECT * FROM contracts WHERE contract_no = ?', [contractNo]);
}

function getContracts(filters = {}, limit = 100, offset = 0) {
  const conditions = [];
  const values = [];

  if (filters.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }
  if (filters.partyA) {
    conditions.push('party_a LIKE ?');
    values.push(`%${filters.partyA}%`);
  }
  if (filters.partyB) {
    conditions.push('party_b LIKE ?');
    values.push(`%${filters.partyB}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return db.runAll(`SELECT * FROM contracts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
}

module.exports = {
  createContract,
  updateContract,
  getContractById,
  getContractByNo,
  getContracts,
};
