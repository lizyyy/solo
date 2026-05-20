const crypto = require('crypto');

function generateMaterialHash(data) {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

function generateBatchNo() {
  const date = new Date();
  const timestamp = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LC-${timestamp}-${random}`;
}

module.exports = {
  generateMaterialHash,
  generateBatchNo
};
