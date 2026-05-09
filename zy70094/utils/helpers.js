const { v4: uuidv4 } = require('uuid');
const { VALIDATION_MESSAGES, ERROR_CODES } = require('./constants');

function generateId() {
  return uuidv4();
}

function getCurrentTime() {
  return new Date().toISOString();
}

function createResponse(success, data = null, message = '', error = null) {
  return {
    success,
    data,
    message,
    error,
    timestamp: getCurrentTime()
  };
}

function createError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function validateRequiredFields(data, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return createError(
      ERROR_CODES.BAD_REQUEST,
      VALIDATION_MESSAGES.MISSING_FIELD(missing.join(', ')),
      { missingFields: missing }
    );
  }
  return null;
}

function isValidStatus(status, validStatuses) {
  return Object.values(validStatuses).includes(status);
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function parseJsonSafely(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  generateId,
  getCurrentTime,
  createResponse,
  createError,
  validateRequiredFields,
  isValidStatus,
  isValidPhone,
  parseJsonSafely,
  delay,
  asyncHandler
};
