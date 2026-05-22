const crypto = require('crypto');

function sortObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = sortObject(obj[key]);
    return result;
  }, {});
}

function generateMaterialHash(data) {
  const sortedData = sortObject(data);
  const serialized = JSON.stringify(sortedData);
  return crypto.createHash('sha256').update(serialized).digest('hex');
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
