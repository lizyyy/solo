const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const checkAndRecordCallback = (callbackId, businessType, businessId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM callback_record WHERE callback_id = ?', [callbackId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row) {
        resolve({ isDuplicate: true, record: row });
        return;
      }
      
      const id = uuidv4();
      const processedAt = new Date().toISOString();
      
      db.run(
        'INSERT INTO callback_record (id, callback_id, business_type, business_id, processed_at, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, callbackId, businessType, businessId, processedAt, 'processed'],
        (insertErr) => {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve({ isDuplicate: false, recordId: id });
          }
        }
      );
    });
  });
};

module.exports = { checkAndRecordCallback };