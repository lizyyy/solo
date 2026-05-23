const moment = require('moment');

const STATUS_CODES = {
  SUCCESS: 'success',
  PENDING_REVIEW: 'pending_review',
  REVIEWED: 'reviewed',
  REJECTED: 'rejected',
  COMPENSATED: 'compensated',
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  VALIDATION_ERROR: 'validation_error',
  SYSTEM_ERROR: 'system_error',
  NOT_FOUND: 'not_found',
  DUPLICATE: 'duplicate'
};

const formatResponse = (options = {}) => {
  const {
    success = true,
    status = STATUS_CODES.SUCCESS,
    message = '',
    data = null,
    meta = {},
    ...rest
  } = options;

  return {
    success,
    status,
    message,
    data,
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
    ...rest
  };
};

const successResponse = (res, data, message = '操作成功', statusCode = 200) => {
  return res.status(statusCode).json(formatResponse({
    success: true,
    status: STATUS_CODES.SUCCESS,
    message,
    data
  }));
};

const createdResponse = (res, data, message = '创建成功') => {
  return res.status(201).json(formatResponse({
    success: true,
    status: STATUS_CODES.SUCCESS,
    message,
    data
  }));
};

const pendingReviewResponse = (res, data, message = '待复核') => {
  return res.status(202).json(formatResponse({
    success: true,
    status: STATUS_CODES.PENDING_REVIEW,
    message,
    data
  }));
};

const rejectedResponse = (res, data, message = '已驳回') => {
  return res.status(403).json(formatResponse({
    success: false,
    status: STATUS_CODES.REJECTED,
    message,
    data
  }));
};

const compensatedResponse = (res, data, message = '已补偿') => {
  return res.status(200).json(formatResponse({
    success: true,
    status: STATUS_CODES.COMPENSATED,
    message,
    data
  }));
};

const errorResponse = (res, message, status = STATUS_CODES.SYSTEM_ERROR, statusCode = 500) => {
  return res.status(statusCode).json(formatResponse({
    success: false,
    status,
    message
  }));
};

const notFoundResponse = (res, message = '资源不存在') => {
  return res.status(404).json(formatResponse({
    success: false,
    status: STATUS_CODES.NOT_FOUND,
    message
  }));
};

const duplicateResponse = (res, message = '资源已存在') => {
  return res.status(409).json(formatResponse({
    success: false,
    status: STATUS_CODES.DUPLICATE,
    message
  }));
};

module.exports = {
  STATUS_CODES,
  formatResponse,
  successResponse,
  createdResponse,
  pendingReviewResponse,
  rejectedResponse,
  compensatedResponse,
  errorResponse,
  notFoundResponse,
  duplicateResponse
};
