const { run, get, all } = require('../database/db');

const createSealRule = async (ruleData) => {
  const sql = `
    INSERT INTO seal_rules (seal_type, description, authorized_persons, max_amount, requires_attachment)
    VALUES (?, ?, ?, ?, ?)
  `;
  return run(sql, [
    ruleData.seal_type,
    ruleData.description || null,
    ruleData.authorized_persons ? JSON.stringify(ruleData.authorized_persons) : null,
    ruleData.max_amount || null,
    ruleData.requires_attachment ? 1 : 0
  ]);
};

const getSealRuleByType = async (sealType) => {
  const sql = 'SELECT * FROM seal_rules WHERE seal_type = ?';
  const rule = await get(sql, [sealType]);
  if (rule && rule.authorized_persons) {
    rule.authorized_persons = JSON.parse(rule.authorized_persons);
  }
  return rule;
};

const getAllSealRules = async () => {
  const sql = 'SELECT * FROM seal_rules ORDER BY created_at DESC';
  const rules = await all(sql);
  return rules.map(r => {
    if (r.authorized_persons) r.authorized_persons = JSON.parse(r.authorized_persons);
    return r;
  });
};

const updateSealRule = async (sealType, ruleData) => {
  const sql = `
    UPDATE seal_rules 
    SET description = ?, authorized_persons = ?, max_amount = ?, requires_attachment = ?
    WHERE seal_type = ?
  `;
  return run(sql, [
    ruleData.description || null,
    ruleData.authorized_persons ? JSON.stringify(ruleData.authorized_persons) : null,
    ruleData.max_amount || null,
    ruleData.requires_attachment ? 1 : 0,
    sealType
  ]);
};

const checkSealAuthorization = async (sealType, authorizer, amount = null) => {
  const rule = await getSealRuleByType(sealType);
  if (!rule) {
    return { authorized: false, reason: '印章类型不存在' };
  }

  if (rule.authorized_persons && !rule.authorized_persons.includes(authorizer)) {
    return { authorized: false, reason: '授权人不在允许名单内' };
  }

  if (rule.max_amount && amount && amount > rule.max_amount) {
    return { authorized: false, reason: `金额超过该印章最大限额 ${rule.max_amount}` };
  }

  return { authorized: true, rule };
};

module.exports = {
  createSealRule,
  getSealRuleByType,
  getAllSealRules,
  updateSealRule,
  checkSealAuthorization
};
