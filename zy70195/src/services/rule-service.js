const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const exceptionService = require('./exception-service');

async function createRule(params) {
  const db = getDb();
  const { name, qualification_type, warning_days = 30, freeze_days = 0 } = params;
  
  if (!name || !qualification_type) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      error: '规则信息不完整',
      raw_data: params
    });
    throw new Error('规则名称和资质类型为必填项');
  }
  
  const existing = await db.get(`
    SELECT * FROM expiry_rules WHERE qualification_type = ? AND is_active = 1
  `, [qualification_type]);
  
  if (existing) {
    await exceptionService.recordException({
      type: 'business_warning',
      severity: 'low',
      error: '该资质类型已有生效规则',
      raw_data: { qualification_type, existing }
    });
  }
  
  const id = 'rule_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO expiry_rules (id, name, qualification_type, warning_days, freeze_days, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `, [id, name, qualification_type, warning_days, freeze_days]);
  
  return getRuleById(id);
}

async function getRuleById(id) {
  const db = getDb();
  return db.get('SELECT * FROM expiry_rules WHERE id = ?', [id]);
}

async function getRuleByType(qualification_type) {
  const db = getDb();
  return db.get(`
    SELECT * FROM expiry_rules 
    WHERE qualification_type = ? AND is_active = 1
  `, [qualification_type]);
}

async function getAllRules(active_only = true) {
  const db = getDb();
  let sql = 'SELECT * FROM expiry_rules';
  if (active_only) {
    sql += ' WHERE is_active = 1';
  }
  sql += ' ORDER BY created_at DESC';
  return db.all(sql);
}

async function updateRule(id, params) {
  const db = getDb();
  const { name, warning_days, freeze_days } = params;
  
  const rule = await getRuleById(id);
  if (!rule) {
    await exceptionService.recordException({
      type: 'data_not_found',
      severity: 'medium',
      error: '规则不存在',
      raw_data: { id }
    });
    throw new Error('规则不存在');
  }
  
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (warning_days !== undefined) {
    updates.push('warning_days = ?');
    values.push(warning_days);
  }
  if (freeze_days !== undefined) {
    updates.push('freeze_days = ?');
    values.push(freeze_days);
  }
  
  if (updates.length === 0) {
    return rule;
  }
  
  updates.push('updated_at = datetime("now")');
  values.push(id);
  
  await db.run(`UPDATE expiry_rules SET ${updates.join(', ')} WHERE id = ?`, values);
  
  return getRuleById(id);
}

async function deactivateRule(id) {
  const db = getDb();
  
  const rule = await getRuleById(id);
  if (!rule) {
    throw new Error('规则不存在');
  }
  
  await db.run(`
    UPDATE expiry_rules SET is_active = 0, updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
  
  return getRuleById(id);
}

async function activateRule(id) {
  const db = getDb();
  
  const rule = await getRuleById(id);
  if (!rule) {
    throw new Error('规则不存在');
  }
  
  await db.run(`
    UPDATE expiry_rules SET is_active = 1, updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
  
  return getRuleById(id);
}

module.exports = {
  createRule,
  getRuleById,
  getRuleByType,
  getAllRules,
  updateRule,
  deactivateRule,
  activateRule
};
