const { runQuery, allQuery, getQuery } = require('../database/db');
const { reloadRules, getCurrentRuleVersion } = require('./inspectionEngine');
const { logAction } = require('./auditService');
const { reloadPatterns } = require('../utils/masking');

async function getRules() {
  return await allQuery('SELECT * FROM inspection_rules ORDER BY severity DESC, id');
}

async function updateRule(id, data, operator, role, ipAddress) {
  const currentVersion = await getCurrentRuleVersion();
  const newVersion = currentVersion + 1;
  
  const result = await runQuery(`
    UPDATE inspection_rules 
    SET rule_name = ?, keywords = ?, severity = ?, is_enabled = ?, version = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.rule_name,
    data.keywords,
    data.severity,
    data.is_enabled ? 1 : 0,
    newVersion,
    id
  ]);

  if (result.changes > 0) {
    await reloadRules();
    await logAction(
      'update_rule',
      null,
      operator,
      role,
      `更新规则：${data.rule_name}，关键词：${data.keywords}`,
      ipAddress
    );
  }

  return result.changes > 0;
}

async function createRule(data, operator, role, ipAddress) {
  const currentVersion = await getCurrentRuleVersion();
  const newVersion = currentVersion + 1;
  
  const result = await runQuery(`
    INSERT INTO inspection_rules (rule_type, rule_name, keywords, severity, is_enabled, version, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.rule_type,
    data.rule_name,
    data.keywords,
    data.severity || 'medium',
    data.is_enabled ? 1 : 0,
    newVersion,
    operator
  ]);

  await reloadRules();
  await logAction(
    'create_rule',
    null,
    operator,
    role,
    `创建规则：${data.rule_name}，关键词：${data.keywords}`,
    ipAddress
  );

  return result.lastID;
}

async function deleteRule(id, operator, role, ipAddress) {
  const rule = await getQuery('SELECT * FROM inspection_rules WHERE id = ?', [id]);
  
  if (!rule) return false;

  const result = await runQuery('DELETE FROM inspection_rules WHERE id = ?', [id]);
  
  if (result.changes > 0) {
    await reloadRules();
    await logAction(
      'delete_rule',
      null,
      operator,
      role,
      `删除规则：${rule.rule_name}`,
      ipAddress
    );
  }

  return result.changes > 0;
}

async function getSensitiveFields() {
  return await allQuery('SELECT * FROM sensitive_fields_config');
}

async function updateSensitiveField(id, data, operator, role, ipAddress) {
  const result = await runQuery(`
    UPDATE sensitive_fields_config 
    SET field_name = ?, mask_pattern = ?, is_enabled = ?
    WHERE id = ?
  `, [
    data.field_name,
    data.mask_pattern,
    data.is_enabled ? 1 : 0,
    id
  ]);

  if (result.changes > 0) {
    await reloadPatterns();
    await logAction(
      'update_sensitive_field',
      null,
      operator,
      role,
      `更新敏感字段配置：${data.field_name}`,
      ipAddress
    );
  }

  return result.changes > 0;
}

async function createSensitiveField(data, operator, role, ipAddress) {
  const result = await runQuery(`
    INSERT INTO sensitive_fields_config (field_name, mask_pattern, is_enabled)
    VALUES (?, ?, ?)
  `, [
    data.field_name,
    data.mask_pattern,
    data.is_enabled ? 1 : 0
  ]);

  await reloadPatterns();
  await logAction(
    'create_sensitive_field',
    null,
    operator,
    role,
    `创建敏感字段配置：${data.field_name}`,
    ipAddress
  );

  return result.lastID;
}

module.exports = {
  getRules,
  updateRule,
  createRule,
  deleteRule,
  getSensitiveFields,
  updateSensitiveField,
  createSensitiveField
};
