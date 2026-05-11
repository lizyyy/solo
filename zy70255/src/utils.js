const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const UUID = () => uuidv4();

const now = () => dayjs().valueOf();

const formatDate = (timestamp) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');

const isExpired = (timestamp) => dayjs(timestamp).isBefore(dayjs());

const response = (res, data, status = 200) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    data
  });
};

const errorResponse = (res, message, status = 400) => {
  res.status(status).json({
    success: false,
    error: message
  });
};

const CAR_TYPES = ['ECONOMY', 'COMFORT', 'PREMIUM', 'SUV'];

const VOUCHER_STATUS = {
  CREATED: 'CREATED',
  IN_QUEUE: 'IN_QUEUE',
  CALLED: 'CALLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  REVOKED: 'REVOKED',
  CORRECTED: 'CORRECTED'
};

const rowToObject = (columns, values) => {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj;
};

const dbGet = (stmt, ...params) => {
  const result = stmt.getAsObject(params);
  return result && Object.keys(result).length > 0 ? result : undefined;
};

const dbAll = (stmt, ...params) => {
  const results = [];
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.reset();
  return results;
};

module.exports = {
  UUID,
  now,
  formatDate,
  isExpired,
  response,
  errorResponse,
  CAR_TYPES,
  VOUCHER_STATUS,
  rowToObject,
  dbGet,
  dbAll
};
