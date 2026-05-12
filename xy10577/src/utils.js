const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const STATUS = {
  APPOINTMENT: {
    SCHEDULED: 'SCHEDULED',
    ARRIVED: 'ARRIVED',
    NO_SHOW: 'NO_SHOW',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },
  VOUCHER: {
    ISSUED: 'ISSUED',
    REDEEMED: 'REDEEMED',
    VOIDED: 'VOIDED',
    EXPIRED: 'EXPIRED'
  }
};

const ERROR_CODES = {
  BUDGET_INSUFFICIENT: 'BUDGET_INSUFFICIENT',
  VISITOR_NOT_ARRIVED: 'VISITOR_NOT_ARRIVED',
  VOUCHER_DUPLICATE: 'VOUCHER_DUPLICATE',
  VOUCHER_EXPIRED: 'VOUCHER_EXPIRED',
  VOUCHER_VOIDED: 'VOUCHER_VOIDED',
  VOUCHER_ALREADY_REDEEMED: 'VOUCHER_ALREADY_REDEEMED',
  VOUCHER_NOT_FOUND: 'VOUCHER_NOT_FOUND',
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  DEPARTMENT_NOT_FOUND: 'DEPARTMENT_NOT_FOUND',
  STALL_NOT_FOUND: 'STALL_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  IDEMPOTENT_CONFLICT: 'IDEMPOTENT_CONFLICT'
};

const formatDate = (date) => moment(date).format('YYYY-MM-DD');
const formatDateTime = (date) => moment(date).format('YYYY-MM-DD HH:mm:ss');
const now = () => moment();
const nowString = () => formatDateTime();
const generateId = () => uuidv4();
const generateVoucherCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'V';
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const isValidDate = (dateStr) => moment(dateStr, 'YYYY-MM-DD', true).isValid();
const isValidDateTime = (dateStr) => moment(dateStr, 'YYYY-MM-DD HH:mm:ss', true).isValid();

const isExpired = (validTo) => {
  return moment().isAfter(moment(validTo, 'YYYY-MM-DD HH:mm:ss'));
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const safeJsonParse = (str) => {
  try {
    return str ? JSON.parse(str) : null;
  } catch (e) {
    return null;
  }
};

module.exports = {
  STATUS,
  ERROR_CODES,
  formatDate,
  formatDateTime,
  now,
  nowString,
  generateId,
  generateVoucherCode,
  isValidDate,
  isValidDateTime,
  isExpired,
  deepClone,
  safeJsonParse
};
