const { getDb } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { logEvent } = require('./auditService');

const createAlarm = (alarmType, { deviceId, commandId, receiptId, level, message, operator }) => {
  const db = getDb();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO alarms (id, alarm_type, device_id, command_id, receipt_id, level, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, alarmType, deviceId || null, commandId || null, receiptId || null, level || 'warning', message);

  logEvent('alarm_created', {
    deviceId,
    commandId,
    operator,
    action: `alarm_${alarmType}`,
    detail: `[${level || 'warning'}] ${message}`,
  });

  return id;
};

const createMismatchAlarm = (command, receipt, operator) => {
  const expectedStatus = command.action === 'start' ? 'running' : 'stopped';
  return createAlarm('status_mismatch', {
    deviceId: command.device_id,
    commandId: command.id,
    receiptId: receipt ? receipt.id : null,
    level: 'critical',
    message: `指令回执不一致：下发 ${command.action} 期望状态 ${expectedStatus}，实际回执为 ${receipt ? receipt.reported_status : '无回执'}`,
    operator,
  });
};

const createTimeoutAlarm = (command, operator) => {
  return createAlarm('receipt_timeout', {
    deviceId: command.device_id,
    commandId: command.id,
    level: 'warning',
    message: `指令回执超时：${command.id} 下发后未在规定时间内收到设备回执`,
    operator,
  });
};

const createInterlockViolationAlarm = (command, reason, operator) => {
  return createAlarm('interlock_violation', {
    deviceId: command.device_id,
    commandId: command.id,
    level: 'warning',
    message: `联锁规则违规尝试：${reason}`,
    operator,
  });
};

const resolveAlarm = (alarmId, resolvedBy = 'system') => {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE alarms SET resolved = 1, resolved_at = datetime('now', 'localtime') WHERE id = ?
  `);
  const result = stmt.run(alarmId);

  if (result.changes > 0) {
    const alarm = db.prepare('SELECT * FROM alarms WHERE id = ?').get(alarmId);
    logEvent('alarm_resolved', {
      deviceId: alarm.device_id,
      commandId: alarm.command_id,
      operator: resolvedBy,
      action: 'resolve_alarm',
      detail: `报警已解除：${alarm.message}`,
    });
  }

  return result.changes > 0;
};

const getAlarms = (filters = {}) => {
  const db = getDb();
  let sql = 'SELECT * FROM alarms WHERE 1=1';
  const params = [];

  if (filters.resolved !== undefined) {
    sql += ' AND resolved = ?';
    params.push(filters.resolved ? 1 : 0);
  }
  if (filters.alarmType) {
    sql += ' AND alarm_type = ?';
    params.push(filters.alarmType);
  }
  if (filters.deviceId) {
    sql += ' AND device_id = ?';
    params.push(filters.deviceId);
  }
  if (filters.commandId) {
    sql += ' AND command_id = ?';
    params.push(filters.commandId);
  }

  sql += ' ORDER BY created_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params);
};

const getAlarmById = (id) => {
  const db = getDb();
  return db.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
};

module.exports = {
  createAlarm,
  createMismatchAlarm,
  createTimeoutAlarm,
  createInterlockViolationAlarm,
  resolveAlarm,
  getAlarms,
  getAlarmById,
};
