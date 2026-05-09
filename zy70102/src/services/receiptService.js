const { getDb } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { logEvent } = require('./auditService');
const { createMismatchAlarm } = require('./alarmService');
const { getCommandById, updateCommandStatus, getPendingCommands } = require('./commandService');

const getReceiptById = (id) => {
  const db = getDb();
  return db.prepare('SELECT * FROM device_receipts WHERE id = ?').get(id);
};

const getReceiptsByCommand = (commandId) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM device_receipts 
    WHERE command_id = ? 
    ORDER BY receipt_time ASC
  `).all(commandId);
};

const getReceiptsByDevice = (deviceId, limit = 50) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM device_receipts 
    WHERE device_id = ? 
    ORDER BY receipt_time DESC 
    LIMIT ?
  `).all(deviceId, limit);
};

const updateDeviceStatus = (deviceId, status) => {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE pump_devices 
    SET current_status = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);
  return stmt.run(status, deviceId);
};

const getDeviceCurrentStatus = (deviceId) => {
  const db = getDb();
  const device = db.prepare('SELECT current_status FROM pump_devices WHERE id = ?').get(deviceId);
  return device ? device.current_status : null;
};

const verifyReceiptAgainstCommand = (receipt, command) => {
  if (!command) {
    return {
      verified: false,
      reason: '找不到对应的控制指令',
    };
  }

  const expectedStatus = command.action === 'start' ? 'running' : 'stopped';

  if (receipt.reported_status === expectedStatus) {
    return {
      verified: true,
      expectedStatus,
      actualStatus: receipt.reported_status,
      reason: '回执状态与指令期望一致',
    };
  } else {
    return {
      verified: false,
      expectedStatus,
      actualStatus: receipt.reported_status,
      reason: `回执状态不匹配：期望 ${expectedStatus}，实际 ${receipt.reported_status}`,
    };
  }
};

const processReceipt = (deviceId, reportedStatus, { source, relatedCommandId, operator }) => {
  const db = getDb();
  if (!['running', 'stopped', 'fault'].includes(reportedStatus)) {
    return {
      success: false,
      error: '无效的状态值，只能是 running、stopped 或 fault',
    };
  }

  let matchedCommand = null;
  
  if (relatedCommandId) {
    matchedCommand = getCommandById(relatedCommandId);
  }

  if (!matchedCommand) {
    const pending = getPendingCommands(deviceId);
    if (pending.length > 0) {
      matchedCommand = pending[0];
    }
  }

  const receiptId = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO device_receipts (id, command_id, device_id, reported_status, source)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(receiptId, matchedCommand ? matchedCommand.id : null, deviceId, reportedStatus, source || 'device');

  const previousStatus = getDeviceCurrentStatus(deviceId);
  updateDeviceStatus(deviceId, reportedStatus);

  logEvent('receipt_received', {
    deviceId,
    commandId: matchedCommand ? matchedCommand.id : null,
    operator,
    action: `status_${reportedStatus}`,
    detail: `设备上报状态：${reportedStatus}，前一状态：${previousStatus || '未知'}`,
  });

  let verification = null;
  if (matchedCommand && ['issued', 'pending'].includes(matchedCommand.status)) {
    verification = verifyReceiptAgainstCommand(
      { reported_status: reportedStatus },
      matchedCommand
    );

    if (verification.verified) {
      updateCommandStatus(matchedCommand.id, 'confirmed');
      logEvent('command_confirmed', {
        deviceId,
        commandId: matchedCommand.id,
        operator,
        action: matchedCommand.action,
        detail: `指令执行确认：${matchedCommand.action} -> ${reportedStatus}`,
      });
    } else {
      updateCommandStatus(matchedCommand.id, 'mismatch');
      logEvent('command_mismatch', {
        deviceId,
        commandId: matchedCommand.id,
        operator,
        action: matchedCommand.action,
        detail: verification.reason,
      });

      createMismatchAlarm(matchedCommand, { id: receiptId, reported_status: reportedStatus }, operator);
    }
  }

  return {
    success: true,
    receiptId,
    deviceId,
    reportedStatus,
    previousStatus,
    matchedCommand: matchedCommand ? {
      id: matchedCommand.id,
      action: matchedCommand.action,
    } : null,
    verification,
  };
};

const getCommandReceiptTrace = (commandId) => {
  const command = getCommandById(commandId);
  if (!command) {
    return null;
  }

  const receipts = getReceiptsByCommand(commandId);

  return {
    command,
    receipts,
    receiptCount: receipts.length,
    hasMismatch: command.status === 'mismatch',
  };
};

module.exports = {
  getReceiptById,
  getReceiptsByCommand,
  getReceiptsByDevice,
  processReceipt,
  getCommandReceiptTrace,
  verifyReceiptAgainstCommand,
  getDeviceCurrentStatus,
};
