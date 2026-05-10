const { table, generateId, now } = require('../utils/db');
const { logAction } = require('../utils/audit');
const moment = require('moment');

const RULE_STATUSES = ['draft', 'active', 'suspended', 'archived'];

function createSupplier(data, operator = 'system') {
  const suppliers = table('suppliers');
  const supplierId = generateId();
  const createdAt = now();
  
  const supplier = suppliers.insert({
    id: supplierId,
    name: data.name,
    contact: data.contact || '',
    created_at: createdAt,
    updated_at: createdAt
  });
  
  logAction('supplier', supplierId, 'create', null, { id: supplierId, ...data }, operator, '创建供应商');
  
  return getSupplier(supplierId);
}

function getSupplier(supplierId) {
  const suppliers = table('suppliers');
  return suppliers.findById(supplierId);
}

function listSuppliers() {
  const suppliers = table('suppliers');
  return [...suppliers._data].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
}

function createRule(data, operator = 'system') {
  const rules = table('rebate_rules');
  const tiers = table('rebate_tiers');
  
  if (!data.supplier_id) {
    throw new Error('必须指定供应商');
  }
  
  const supplier = getSupplier(data.supplier_id);
  if (!supplier) {
    throw new Error('供应商不存在');
  }
  
  if (!data.start_date || !data.end_date) {
    throw new Error('必须指定规则生效日期范围');
  }
  
  if (moment(data.start_date).isAfter(data.end_date)) {
    throw new Error('开始日期不能晚于结束日期');
  }
  
  if (!data.tiers || !Array.isArray(data.tiers) || data.tiers.length === 0) {
    throw new Error('必须至少设置一个档位');
  }
  
  const ruleId = generateId();
  const createdAt = now();
  
  rules.insert({
    id: ruleId,
    supplier_id: data.supplier_id,
    name: data.name,
    description: data.description || '',
    start_date: data.start_date,
    end_date: data.end_date,
    status: 'draft',
    created_at: createdAt,
    updated_at: createdAt
  });
  
  for (let i = 0; i < data.tiers.length; i++) {
    const tier = data.tiers[i];
    const tierId = generateId();
    
    if (tier.min_quantity === undefined || tier.rebate_rate === undefined) {
      throw new Error('档位必须指定最低销量和返利比例');
    }
    
    tiers.insert({
      id: tierId,
      rule_id: ruleId,
      tier_level: i + 1,
      min_quantity: tier.min_quantity,
      max_quantity: tier.max_quantity !== undefined ? tier.max_quantity : null,
      rebate_rate: tier.rebate_rate,
      created_at: createdAt
    });
  }
  
  logAction('rebate_rule', ruleId, 'create', null, { id: ruleId, ...data }, operator, '创建返利规则');
  
  return getRule(ruleId);
}

function getRule(ruleId) {
  const rules = table('rebate_rules');
  const tiers = table('rebate_tiers');
  const rule = rules.findById(ruleId);
  
  if (!rule) return null;
  
  const ruleTiers = tiers.findAll({ rule_id: ruleId })
    .sort((a, b) => a.tier_level - b.tier_level);
  
  return { ...rule, tiers: ruleTiers };
}

function listRules(supplierId = null) {
  const rules = table('rebate_rules');
  const tiers = table('rebate_tiers');
  
  let ruleList = [...rules._data];
  
  if (supplierId) {
    ruleList = ruleList.filter(r => r.supplier_id === supplierId);
  }
  
  ruleList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return ruleList.map(rule => {
    const ruleTiers = tiers.findAll({ rule_id: rule.id })
      .sort((a, b) => a.tier_level - b.tier_level);
    return { ...rule, tiers: ruleTiers };
  });
}

function activateRule(ruleId, operator = 'system') {
  const rules = table('rebate_rules');
  const rule = rules.findById(ruleId);
  
  if (!rule) {
    throw new Error('规则不存在');
  }
  
  if (rule.status !== 'draft') {
    throw new Error('只有草稿状态的规则才能激活');
  }
  
  const previousState = { ...rule };
  
  const updated = rules.update(ruleId, {
    status: 'active',
    updated_at: now()
  });
  
  const updatedRule = getRule(ruleId);
  
  logAction('rebate_rule', ruleId, 'activate', previousState, updatedRule, operator, '激活返利规则');
  
  return updatedRule;
}

function suspendRule(ruleId, operator = 'system') {
  const rules = table('rebate_rules');
  const rule = rules.findById(ruleId);
  
  if (!rule) {
    throw new Error('规则不存在');
  }
  
  if (rule.status !== 'active') {
    throw new Error('只有激活状态的规则才能暂停');
  }
  
  const previousState = { ...rule };
  
  const updated = rules.update(ruleId, {
    status: 'suspended',
    updated_at: now()
  });
  
  const updatedRule = getRule(ruleId);
  
  logAction('rebate_rule', ruleId, 'suspend', previousState, updatedRule, operator, '暂停返利规则');
  
  return updatedRule;
}

function archiveRule(ruleId, operator = 'system') {
  const rules = table('rebate_rules');
  const rule = rules.findById(ruleId);
  
  if (!rule) {
    throw new Error('规则不存在');
  }
  
  const previousState = { ...rule };
  
  const updated = rules.update(ruleId, {
    status: 'archived',
    updated_at: now()
  });
  
  const updatedRule = getRule(ruleId);
  
  logAction('rebate_rule', ruleId, 'archive', previousState, updatedRule, operator, '归档返利规则');
  
  return updatedRule;
}

function getApplicableRule(supplierId, period) {
  const rules = table('rebate_rules');
  const periodDate = moment(period + '-01');
  const periodStart = periodDate.startOf('month').format('YYYY-MM-DD');
  const periodEnd = periodDate.endOf('month').format('YYYY-MM-DD');
  
  const applicableRules = rules._data.filter(rule => 
    rule.supplier_id === supplierId &&
    rule.status === 'active' &&
    rule.start_date <= periodEnd &&
    rule.end_date >= periodStart
  );
  
  if (applicableRules.length === 0) {
    return null;
  }
  
  if (applicableRules.length > 1) {
    throw new Error('存在多个适用的返利规则，请检查规则配置');
  }
  
  return getRule(applicableRules[0].id);
}

module.exports = {
  createSupplier,
  getSupplier,
  listSuppliers,
  createRule,
  getRule,
  listRules,
  activateRule,
  suspendRule,
  archiveRule,
  getApplicableRule,
  RULE_STATUSES
};
