const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const recordStatusHistory = (businessType, businessId, beforeStatus, afterStatus, operator, remark = '', beforeValue = null, afterValue = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO status_history (id, business_type, business_id, before_status, after_status, before_value, after_value, operator, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), businessType, businessId, beforeStatus, afterStatus, beforeValue ? JSON.stringify(beforeValue) : null, afterValue ? JSON.stringify(afterValue) : null, operator, remark],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};
module.exports = { recordStatusHistory };
