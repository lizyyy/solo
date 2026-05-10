const { v4: uuidv4 } = require('uuid');

function generateUUID() {
  return uuidv4();
}

function generateTicketNo(businessType = '') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const prefix = businessType ? `${businessType.toUpperCase()}-` : 'DR-';
  return `${prefix}${year}${month}${day}-${random}`;
}

function getTimestamp() {
  return Date.now();
}

module.exports = {
  generateUUID,
  generateTicketNo,
  getTimestamp
};