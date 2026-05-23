const CryptoJS = require('crypto-js');

function generateHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function generateBatchNo() {
  const date = new Date();
  const timestamp = date.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${timestamp}-${random}`;
}

module.exports = { generateHash, generateBatchNo };
