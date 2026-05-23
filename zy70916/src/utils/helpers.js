const crypto = require('crypto');

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return 'BATCH-' + dateStr + '-' + random;
}

function generateRecordNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return 'REC-' + timestamp + '-' + random;
}

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'SO-' + dateStr + '-' + random;
}

module.exports = {
  generateBatchNo,
  generateRecordNo,
  generateOrderNo
};
