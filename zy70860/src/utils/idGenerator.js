const moment = require('moment');

const generateId = (prefix) => {
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

const generateRecordId = () => generateId('REC');
const generateLogId = () => generateId('LOG');
const generateOrderNumber = () => generateId('ORD');

module.exports = {
  generateId,
  generateRecordId,
  generateLogId,
  generateOrderNumber
};
