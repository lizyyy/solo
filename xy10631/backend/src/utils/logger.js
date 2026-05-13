const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const logOperation = (businessType, businessId, operationType, fieldName, oldValue, newValue, operatorId, operatorName, notes = '') => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const operationTime = new Date().toISOString();
    
    const sql = `
      INSERT INTO operation_log (id, business_type, business_id, operation_type, field_name, old_value, new_value, operator_id, operator_name, operation_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [id, businessType, businessId, operationType, fieldName, oldValue, newValue, operatorId, operatorName, operationTime, notes], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(id);
      }
    });
  });
};

const getLogsByBusiness = (businessType, businessId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM operation_log WHERE business_type = ? AND business_id = ? ORDER BY operation_time DESC`;
    db.all(sql, [businessType, businessId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = { logOperation, getLogsByBusiness };