const { getDb } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { validateCommandAgainstRules } = require('./interlockService');
const { logEvent } = require('./auditService');
const { createInterlockViolationAlarm } = require('./alarmService');

const getDeviceById = (id) => {
  const db = getDb();
  return db.prepare('SELECT * FROM pump_devices WHERE id = ?').get(id);
};

const getCommandById = (id) => {
  const db = getDb();
  return db.prepare('SELECT * FROM control_commands WHERE id = ?').get(id);
};

const getCommands = (filters = {}) => {
  const db = getDb();
  let sql = 'SELECT * FROM control_commands WHERE 1=1';
  const params = [];

  if (filters.deviceId) {
    sql += ' AND device_id = ?';
    params.push(filters.deviceId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.startTime) {
    sql += ' AND created_at >= ?';
    params.push(filters.startTime);
  }

  sql += ' ORDER BY created_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params);
};

const createCommand = (deviceId, action, { source, operator, reason }) => {
  const db = getDb();
  const device = getDeviceById(deviceId);
  if (!device) {
    return {
      success: false,
      error: '设备不存在',
    };
  }

  if (!['start', 'stop'].includes(action)) {
    return {
      success: false,
      error: '无效的操作类型，只能是 start 或 stop',
    };
  }

  const commandId = uuidv4();

  const validation = validateCommandAgainstRules(deviceId, action, commandId, operator);

  if (!validation.allowed) {
    const stmt = db.prepare(`
      INSERT INTO control_commands (id, device_id, action, source, operator, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'rejected')
    `);
    stmt.run(commandId, deviceId, action, source || 'api', operator || 'anonymous', reason || null);

    logEvent('command_rejected', {
      deviceId,
      commandId,
      operator,
      action,
      detail: validation.reason,
    });

    createInterlockViolationAlarm(
      { id: commandId, device_id: deviceId, action },
      validation.reason,
      operator
    );

    return {
      success: false,
      error: validation.reason,
      commandId,
      evaluations: validation.evaluations,
    };
  }

  const stmt = db.prepare(`
    INSERT INTO control_commands (id, device_id, action, source, operator, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'issued')
  `);
  stmt.run(commandId, deviceId, action, source || 'api', operator || 'anonymous', reason || null);

  logEvent('command_issued', {
    deviceId,
    commandId,
    operator,
    action,
    detail: `指令下发成功，原因：${reason || '未填写'}`,
  });

  return {
    success: true,
    commandId,
    device: {
      id: device.id,
      name: device.name,
      currentStatus: device.current_status,
    },
    action,
    evaluations: validation.evaluations,
  };
};

const updateCommandStatus = (commandId, status) => {
  const db = getDb();
  const stmt = db.prepare('UPDATE control_commands SET status = ? WHERE id = ?');
  return stmt.run(status, commandId);
};

const getPendingCommands = (deviceId) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM control_commands 
    WHERE device_id = ? AND status IN ('issued', 'pending')
    ORDER BY created_at DESC
  `).all(deviceId);
};

module.exports = {
  getDeviceById,
  getCommandById,
  getCommands,
  createCommand,
  updateCommandStatus,
  getPendingCommands,
};
