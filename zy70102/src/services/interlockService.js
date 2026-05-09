const { getDb } = require('../database/connection');
const { logEvent } = require('./auditService');

const getAllRules = (onlyActive = true) => {
  const db = getDb();
  let sql = 'SELECT * FROM interlock_rules';
  if (onlyActive) {
    sql += ' WHERE is_active = 1';
  }
  return db.prepare(sql).all();
};

const getRuleById = (id) => {
  const db = getDb();
  return db.prepare('SELECT * FROM interlock_rules WHERE id = ?').get(id);
};

const logRuleExecution = (rule, commandId, deviceId, action, conditionMet, decision, reason) => {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO rule_execution_logs (rule_id, command_id, device_id, action, condition_met, decision, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(rule ? rule.id : null, commandId, deviceId, action, conditionMet ? 1 : 0, decision, reason);
};

const checkDeviceStatus = (deviceId) => {
  const db = getDb();
  const device = db.prepare('SELECT current_status FROM pump_devices WHERE id = ?').get(deviceId);
  return device ? device.current_status : null;
};

const evaluateRule = (rule, targetDeviceId, action) => {
  if (rule.target_device !== targetDeviceId) {
    return {
      applicable: false,
      decision: 'allow',
      reason: '规则不针对此设备',
    };
  }

  if (rule.forbidden_action !== action) {
    return {
      applicable: false,
      decision: 'allow',
      reason: '规则不限制此操作',
    };
  }

  const conditionStatus = checkDeviceStatus(rule.condition_device);
  const conditionMet = conditionStatus === rule.condition_status;

  let decision, reason;

  switch (rule.rule_type) {
    case 'mutual_exclusion':
      if (conditionMet) {
        decision = 'block';
        reason = `互锁规则触发：${rule.condition_device} 当前状态为 ${conditionStatus}，禁止 ${targetDeviceId} 执行 ${action}`;
      } else {
        decision = 'allow';
        reason = `互锁条件未满足：${rule.condition_device} 当前状态为 ${conditionStatus}，规则放行`;
      }
      break;

    case 'dependency':
      if (conditionMet) {
        decision = 'block';
        reason = `依赖规则触发：${rule.condition_device} 当前状态为 ${conditionStatus}，${targetDeviceId} 执行 ${action} 需要依赖条件不满足`;
      } else {
        decision = 'allow';
        reason = `依赖条件已满足或规则允许：${rule.condition_device} 当前状态为 ${conditionStatus}，规则放行`;
      }
      break;

    default:
      decision = 'allow';
      reason = '未知规则类型，默认放行';
  }

  return {
    applicable: true,
    conditionMet,
    decision,
    reason,
    ruleName: rule.name,
    ruleType: rule.rule_type,
  };
};

const validateCommandAgainstRules = (deviceId, action, commandId, operator) => {
  const rules = getAllRules(true);
  const evaluationResults = [];
  let shouldBlock = false;
  let blockReason = '';

  for (const rule of rules) {
    const result = evaluateRule(rule, deviceId, action);
    
    if (result.applicable) {
      evaluationResults.push(result);
      logRuleExecution(rule, commandId, deviceId, action, result.conditionMet, result.decision, result.reason);

      if (result.decision === 'block') {
        shouldBlock = true;
        blockReason = result.reason;
      }
    } else {
      logRuleExecution(rule, commandId, deviceId, action, false, 'allow', result.reason);
    }
  }

  if (evaluationResults.length === 0) {
    logEvent('rule_check_passed', {
      deviceId,
      commandId,
      operator,
      action,
      detail: '无适用的联锁规则，指令通过检查',
    });
  } else if (shouldBlock) {
    logEvent('rule_check_blocked', {
      deviceId,
      commandId,
      operator,
      action,
      detail: blockReason,
    });
  } else {
    logEvent('rule_check_passed', {
      deviceId,
      commandId,
      operator,
      action,
      detail: '所有适用联锁规则均通过',
    });
  }

  return {
    allowed: !shouldBlock,
    reason: shouldBlock ? blockReason : '通过联锁检查',
    evaluations: evaluationResults,
  };
};

const getRuleExecutionLogs = (filters = {}) => {
  const db = getDb();
  let sql = 'SELECT rl.*, ir.name as rule_name FROM rule_execution_logs rl LEFT JOIN interlock_rules ir ON rl.rule_id = ir.id WHERE 1=1';
  const params = [];

  if (filters.commandId) {
    sql += ' AND rl.command_id = ?';
    params.push(filters.commandId);
  }
  if (filters.deviceId) {
    sql += ' AND rl.device_id = ?';
    params.push(filters.deviceId);
  }

  sql += ' ORDER BY rl.executed_at DESC';
  return db.prepare(sql).all(...params);
};

module.exports = {
  getAllRules,
  getRuleById,
  validateCommandAgainstRules,
  getRuleExecutionLogs,
  checkDeviceStatus,
};
