const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const logOperation = (operationType, module, recordId, operatorId, operatorName, oldValue, newValue, description, ipAddress) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs (id, operation_type, module, record_id, operator_id, operator_name, old_value, new_value, description, ip_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        operationType,
        module,
        recordId,
        operatorId,
        operatorName,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        description,
        ipAddress || '127.0.0.1',
        moment().toISOString()
      ],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

module.exports = { logOperation };
