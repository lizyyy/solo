const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function generateId() {
  return uuidv4();
}

function generateOrderNo() {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
}

function generatePaymentNo() {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAY${timestamp}${random}`;
}

function generateRefundNo() {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REF${timestamp}${random}`;
}

function now() {
  return dayjs().toISOString();
}

function formatPrice(price) {
  return Number(price.toFixed(2));
}

function addMinutes(minutes) {
  return dayjs().add(minutes, 'minute').toISOString();
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return dayjs().isAfter(dayjs(expiresAt));
}

function isBetween(startTime, endTime) {
  const nowTime = dayjs();
  if (startTime && nowTime.isBefore(dayjs(startTime))) return false;
  if (endTime && nowTime.isAfter(dayjs(endTime))) return false;
  return true;
}

class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BusinessError';
  }
}

module.exports = {
  generateId,
  generateOrderNo,
  generatePaymentNo,
  generateRefundNo,
  now,
  formatPrice,
  addMinutes,
  isExpired,
  isBetween,
  BusinessError,
};
