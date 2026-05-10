const moment = require('moment');

function getCurrentTimestamp() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

function formatDate(dateStr) {
  return moment(dateStr).format('YYYY-MM-DD');
}

function parseJsonSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function isDateValid(dateStr) {
  return moment(dateStr, 'YYYY-MM-DD', true).isValid();
}

function buildSuccessResponse(data, message = '操作成功') {
  return {
    success: true,
    message,
    data,
    timestamp: getCurrentTimestamp()
  };
}

function buildErrorResponse(message, errorCode = 500, details = null) {
  return {
    success: false,
    errorCode,
    message,
    details,
    timestamp: getCurrentTimestamp()
  };
}

module.exports = {
  getCurrentTimestamp,
  formatDate,
  parseJsonSafe,
  isDateValid,
  buildSuccessResponse,
  buildErrorResponse
};
