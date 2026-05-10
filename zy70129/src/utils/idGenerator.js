const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function generateOrderNo(prefix = 'ORD') {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${random}`;
}

function generateTransactionNo() {
  const now = new Date();
  const timestamp = now.getTime().toString();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

function generateIdempotencyKey() {
  return uuidv4();
}

module.exports = {
  generateId,
  generateOrderNo,
  generateTransactionNo,
  generateIdempotencyKey
};
