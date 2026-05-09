const db = require('../database/connection');
const { getAuditLogs, getAuditByCommandId } = require('./auditService');
const { getRuleExecutionLogs } = require('./interlockService');
const { getAlarms } = require('./alarmService');
const { getCommandReceiptTrace } = require('./receiptService');
const { getCommands } = require('./commandService');

const getCommandFullTrace = (commandId) => {
  const commandTrace = getCommandReceiptTrace(commandId);
  if (!commandTrace) {
    return null;
  }

  const auditLogs = getAuditByCommandId(commandId);
  const ruleLogs = getRuleExecutionLogs({ commandId });
  const alarms = getAlarms({ commandId });

  return {
    command: commandTrace.command,
    receipts: commandTrace.receipts,
    auditTrail: auditLogs,
    ruleEvaluations: ruleLogs,
    alarms,
    summary: {
      commandStatus: commandTrace.command.status,
      receiptCount: commandTrace.receipts.length,
      auditLogCount: auditLogs.length,
      ruleCheckCount: ruleLogs.length,
      hasUnresolvedAlarms: alarms.some(a => a.resolved === 0),
    },
  };
};

const getDeviceEventTimeline = (deviceId, startTime, endTime) => {
  const filters = { deviceId, startTime, endTime };
  
  const commands = getCommands(filters);
  const auditLogs = getAuditLogs(filters);
  const ruleLogs = getRuleExecutionLogs({ deviceId });
  const alarms = getAlarms({ deviceId });

  const events = [];

  commands.forEach(cmd => {
    events.push({
      type: 'command',
      time: cmd.created_at,
      data: cmd,
      description: `指令 ${cmd.action} - ${cmd.status}`,
    });
  });

  auditLogs.forEach(log => {
    events.push({
      type: 'audit',
      time: log.created_at,
      data: log,
      description: `[${log.event_type}] ${log.action || ''} - ${log.detail || ''}`,
    });
  });

  ruleLogs.forEach(rl => {
    events.push({
      type: 'rule',
      time: rl.executed_at,
      data: rl,
      description: `规则 [${rl.rule_name || rl.rule_id}] - ${rl.decision}`,
    });
  });

  alarms.forEach(alarm => {
    events.push({
      type: 'alarm',
      time: alarm.created_at,
      data: alarm,
      description: `[${alarm.alarm_type}][${alarm.level}] ${alarm.message}${alarm.resolved ? '(已解除)' : ''}`,
    });
  });

  events.sort((a, b) => new Date(a.time) - new Date(b.time));

  return {
    deviceId,
    startTime,
    endTime,
    eventCount: events.length,
    timeline: events,
  };
};

const getConsistencyReport = (commandId) => {
  const trace = getCommandFullTrace(commandId);
  if (!trace) {
    return { error: '指令不存在' };
  }

  const issues = [];
  const confirmations = [];

  if (trace.ruleEvaluations.length > 0) {
    const blockedRules = trace.ruleEvaluations.filter(r => r.decision === 'block');
    if (blockedRules.length > 0) {
      issues.push({
        type: 'interlock_block',
        detail: `有 ${blockedRules.length} 条联锁规则触发阻止`,
        rules: blockedRules.map(r => ({ ruleId: r.rule_id, ruleName: r.rule_name })),
      });
    } else {
      confirmations.push(`联锁规则检查通过，共评估 ${trace.ruleEvaluations.length} 条规则`);
    }
  }

  if (trace.receipts.length === 0) {
    issues.push({
      type: 'no_receipt',
      detail: '指令未收到任何设备回执',
    });
  } else {
    confirmations.push(`已收到 ${trace.receipts.length} 条设备回执`);
    
    const latestReceipt = trace.receipts[trace.receipts.length - 1];
    const expectedStatus = trace.command.action === 'start' ? 'running' : 'stopped';
    
    if (latestReceipt.reported_status === expectedStatus) {
      confirmations.push(`最终回执状态 ${latestReceipt.reported_status} 与指令 ${trace.command.action} 一致`);
    } else {
      issues.push({
        type: 'status_mismatch',
        detail: `回执状态不一致：指令 ${trace.command.action} 期望 ${expectedStatus}，实际回执 ${latestReceipt.reported_status}`,
      });
    }
  }

  if (trace.hasUnresolvedAlarms) {
    issues.push({
      type: 'unresolved_alarms',
      detail: `存在 ${trace.alarms.filter(a => a.resolved === 0).length} 条未解除报警`,
    });
  }

  return {
    commandId,
    status: trace.command.status,
    isConsistent: issues.length === 0,
    issues,
    confirmations,
    auditCount: trace.auditTrail.length,
  };
};

const searchEvents = (keyword, { deviceId, startTime, endTime, eventTypes } = {}) => {
  const results = {
    commands: [],
    alarms: [],
    auditLogs: [],
  };

  const commandFilters = {};
  if (deviceId) commandFilters.deviceId = deviceId;
  if (startTime) commandFilters.startTime = startTime;
  
  const commands = getCommands(commandFilters);
  results.commands = commands.filter(cmd => 
    (keyword && (cmd.id.includes(keyword) || (cmd.reason && cmd.reason.includes(keyword)))) || !keyword
  );

  const alarmFilters = {};
  if (deviceId) alarmFilters.deviceId = deviceId;
  
  const alarms = getAlarms(alarmFilters);
  results.alarms = alarms.filter(alarm =>
    (keyword && alarm.message.includes(keyword)) || !keyword
  );

  const auditFilters = {};
  if (deviceId) auditFilters.deviceId = deviceId;
  if (startTime) auditFilters.startTime = startTime;
  if (endTime) auditFilters.endTime = endTime;
  
  const auditLogs = getAuditLogs(auditFilters);
  results.auditLogs = auditLogs.filter(log =>
    (keyword && (
      (log.detail && log.detail.includes(keyword)) ||
      (log.action && log.action.includes(keyword)) ||
      log.event_type.includes(keyword)
    )) || !keyword
  );

  return results;
};

module.exports = {
  getCommandFullTrace,
  getDeviceEventTimeline,
  getConsistencyReport,
  searchEvents,
};
