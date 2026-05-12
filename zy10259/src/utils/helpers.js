const crypto = require('crypto');
const moment = require('moment');

function generateOrderNo() {
  return `ORD${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateOutboundNo() {
  return `OUT${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateExtensionNo() {
  return `EXT${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateExchangeNo() {
  return `EXC${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateReturnNo() {
  return `RET${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateTransactionNo() {
  return `TRA${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function generateBillNo() {
  return `BIL${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function calculateDays(startDate, endDate) {
  const start = moment(startDate);
  const end = moment(endDate);
  return end.diff(start, 'days') + 1;
}

function hashRequest(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function formatDate(date) {
  return moment(date).format('YYYY-MM-DD');
}

function formatDateTime(date) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  generateOrderNo,
  generateOutboundNo,
  generateExtensionNo,
  generateExchangeNo,
  generateReturnNo,
  generateTransactionNo,
  generateBillNo,
  calculateDays,
  hashRequest,
  formatDate,
  formatDateTime
};
