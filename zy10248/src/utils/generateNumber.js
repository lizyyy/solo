const moment = require('moment');

const generateReportNumber = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DR${dateStr}${random}`;
};

const generateCompensationNumber = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CP${dateStr}${random}`;
};

module.exports = {
  generateReportNumber,
  generateCompensationNumber
};
