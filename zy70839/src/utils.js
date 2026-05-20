const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

function generateBatchHash(materials) {
  const sorted = materials.map(m => {
    return JSON.stringify({
      key_number: m.key_number || '',
      fuel_card_number: m.fuel_card_number || '',
      violation_records: m.violation_records || ''
    });
  }).sort().join('|');
  
  return crypto.createHash('md5').update(sorted).digest('hex');
}

function generateId() {
  return uuidv4();
}

const TASK_STATUS = {
  PROCESSING: 'processing',
  FAILED: 'failed',
  MANUAL_CONFIRM: 'manual_confirm',
  EXPORTED: 'exported'
};

module.exports = {
  generateBatchHash,
  generateId,
  TASK_STATUS
};