const crypto = require('crypto');

const RULES = {
  R001: {
    id: 'R001',
    name: '车位入住唯一性',
    description: '同一时间同一车位只能有一个在住记录',
    category: '入住规则'
  },
  R002: {
    id: 'R002',
    name: '入住时间校验',
    description: '入住时间不能晚于当前时间，且不能早于车位最近一次退营时间',
    category: '入住规则'
  },
  R003: {
    id: 'R003',
    name: '读数时间顺序',
    description: '新读数时间必须晚于该水电桩所有历史读数',
    category: '读数规则'
  },
  R004: {
    id: 'R004',
    name: '读数单调递增',
    description: '水电表读数不能回退（除非是修正读数）',
    category: '读数规则'
  },
  R005: {
    id: 'R005',
    name: '桩位绑定有效性',
    description: '分摊时车位必须绑定到对应水电桩',
    category: '分摊规则'
  },
  R006: {
    id: 'R006',
    name: '分摊时间段有效性',
    description: '分摊时间段必须完全落在入住-退营期间内',
    category: '分摊规则'
  },
  R007: {
    id: 'R007',
    name: '分时占用归属',
    description: '读数分段归属：谁在用谁承担，按读数时间与入住时间匹配',
    category: '分摊规则'
  },
  R008: {
    id: 'R008',
    name: '押金完整性',
    description: '退营结算时押金必须 >= 实际费用，否则产生差额记录',
    category: '结算规则'
  },
  R009: {
    id: 'R009',
    name: '幂等性校验',
    description: '相同request_id返回相同结果，不得重复写入',
    category: '接口规则'
  },
  R010: {
    id: 'R010',
    name: '脏数据追踪',
    description: '数据校验失败不得静默跳过，必须进入问题列表',
    category: '接口规则'
  }
};

function checksum(obj) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex')
    .substring(0, 16);
}

class RuleViolation extends Error {
  constructor(ruleId, details, sourceType, sourceRef) {
    const rule = RULES[ruleId];
    super(`规则违反 [${ruleId}] ${rule ? rule.name : '未知规则'}: ${details}`);
    this.ruleId = ruleId;
    this.ruleName = rule ? rule.name : '未知规则';
    this.details = details;
    this.sourceType = sourceType;
    this.sourceRef = sourceRef;
    this.name = 'RuleViolation';
  }
}

class ValidationError extends Error {
  constructor(message, field, details) {
    super(message);
    this.field = field;
    this.details = details;
    this.name = 'ValidationError';
  }
}

function getRules() {
  return Object.values(RULES);
}

function getRule(ruleId) {
  return RULES[ruleId];
}

module.exports = {
  RULES,
  checksum,
  RuleViolation,
  ValidationError,
  getRules,
  getRule
};
