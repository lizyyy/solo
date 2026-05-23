const moment = require('moment');

let ExceptionLogDAO = null;

const lazyLoadDAO = () => {
  if (!ExceptionLogDAO) {
    const dao = require('../database/dao');
    ExceptionLogDAO = dao.ExceptionLogDAO;
  }
  return ExceptionLogDAO;
};

const generateExceptionCode = () => {
  return `EXC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

const logBusinessException = async (req, errorType, errorMessage, conclusion = 'handled') => {
  try {
    const DAO = lazyLoadDAO();
    const exceptionLogDAO = new DAO();
    const exceptionCode = generateExceptionCode();
    await exceptionLogDAO.create({
      exception_code: exceptionCode,
      api_endpoint: `${req.method} ${req.path}`,
      original_input: JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      }),
      error_message: errorMessage,
      processing_conclusion: `${errorType}: ${conclusion}`,
      status: 'handled'
    });
    return exceptionCode;
  } catch (logErr) {
    console.error('记录业务异常日志失败:', logErr);
    return null;
  }
};

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

const errorResponse = async (res, message, status = STATUS_CODES.SYSTEM_ERROR, statusCode = 500, req = null) => {
  let exceptionCode = null;
  if (req) {
    exceptionCode = await logBusinessException(req, 'system_error', message, 'error_returned');
  }
  return res.status(statusCode).json(formatResponse({
    success: false,
    status,
    exception_code: exceptionCode,
    message
  }));
};

const notFoundResponse = async (res, message = '资源不存在', req = null) => {
  let exceptionCode = null;
  if (req) {
    exceptionCode = await logBusinessException(req, 'not_found', message, 'resource_missing');
  }
  return res.status(404).json(formatResponse({
    success: false,
    status: STATUS_CODES.NOT_FOUND,
    exception_code: exceptionCode,
    message
  }));
};

const duplicateResponse = async (res, message = '资源已存在', req = null) => {
  let exceptionCode = null;
  if (req) {
    exceptionCode = await logBusinessException(req, 'duplicate', message, 'resource_conflict');
  }
  return res.status(409).json(formatResponse({
    success: false,
    status: STATUS_CODES.DUPLICATE,
    exception_code: exceptionCode,
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
