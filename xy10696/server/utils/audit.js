const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const logAudit = (tableName, recordId, fieldName, oldValue, newValue, operator) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO audit_logs (id, table_name, record_id, field_name, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), tableName, recordId, fieldName, oldValue, newValue, operator],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const logFlow = (deviceId, deviceNumber, orderId, flowType, beforeData, afterData, operator, remark = '') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO flow_records (id, device_id, device_number, order_id, flow_type, before_data, after_data, operator, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), deviceId, deviceNumber, orderId, flowType, JSON.stringify(beforeData), JSON.stringify(afterData), operator, remark],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const logException = (deviceId, deviceNumber, orderId, exceptionType, description, operator, responsiblePerson = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO exceptions (id, device_id, device_number, order_id, exception_type, description, status, responsible_person, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), deviceId, deviceNumber, orderId, exceptionType, description, 'pending', responsiblePerson, operator],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

module.exports = { logAudit, logFlow, logException };
