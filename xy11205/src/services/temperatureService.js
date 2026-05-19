const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../models/database');
const { logAction } = require('./auditService');
const {
  validateTemperature,
  validateDate,
  validateRole,
  validateOperator
} = require('../utils/validator');

function createTemperatureRecord(data, operator, role) {
  const db = getDatabase();
  
  const roleValidation = validateRole(role);
  const operatorValidation = validateOperator(operator);
  
  if (!roleValidation.valid || !operatorValidation.valid) {
    throw new Error('角色或操作人校验失败');
  }
  
  const tempValidation = validateTemperature(data.temperature);
  if (!tempValidation.valid) {
    throw new Error(tempValidation.message);
  }
  
  const timeValidation = validateDate(data.record_time);
  if (!timeValidation.valid) {
    throw new Error(timeValidation.message);
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO temperature_records (
      id, arrival_order_id, temperature, record_time,
      recorder, is_valid, created_at, operator, role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    data.arrival_order_id,
    parseFloat(data.temperature),
    data.record_time,
    data.recorder.trim(),
    1,
    now,
    operator,
    role
  );
  
  logAction('create', 'temperature_records', id, null, data, operator, role);
  
  return getTemperatureRecordById(id);
}

function getTemperatureRecordById(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM temperature_records WHERE id = ?');
  return stmt.get(id);
}

function getTemperatureRecordsByOrderId(arrivalOrderId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM temperature_records WHERE arrival_order_id = ? ORDER BY record_time');
  return stmt.all(arrivalOrderId);
}

function getAllTemperatureRecords(options = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM temperature_records WHERE 1=1';
  const params = [];
  
  if (options.start_time) {
    query += ' AND record_time >= ?';
    params.push(options.start_time);
  }
  
  if (options.end_time) {
    query += ' AND record_time <= ?';
    params.push(options.end_time);
  }
  
  query += ' ORDER BY record_time DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

module.exports = {
  createTemperatureRecord,
  getTemperatureRecordById,
  getTemperatureRecordsByOrderId,
  getAllTemperatureRecords
};
