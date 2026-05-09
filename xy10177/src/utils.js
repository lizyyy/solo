const { v4: uuidv4 } = require('uuid');
const { format, parseISO, addMinutes } = require('date-fns');

function generateId() {
  return uuidv4();
}

function now() {
  return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
}

function formatDate(date) {
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss');
}

function parseDate(dateStr) {
  return parseISO(dateStr.replace(' ', 'T'));
}

function timesOverlap(start1, end1, start2, end2) {
  const s1 = parseDate(start1).getTime();
  const e1 = parseDate(end1).getTime();
  const s2 = parseDate(start2).getTime();
  const e2 = parseDate(end2).getTime();
  return s1 < e2 && e1 > s2;
}

function jsonResponse(res, statusCode, data) {
  res.status(statusCode).json(data);
}

function errorResponse(res, statusCode, message, details = {}) {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...details,
  });
}

function successResponse(res, data) {
  res.status(200).json({
    success: true,
    ...data,
  });
}

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = {
  generateId,
  now,
  formatDate,
  parseDate,
  timesOverlap,
  jsonResponse,
  errorResponse,
  successResponse,
  AppError,
};
