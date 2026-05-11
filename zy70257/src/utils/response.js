function success(data, message = '操作成功') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  };
}

function error(code, message, details = null) {
  return {
    code,
    message,
    details,
    timestamp: Date.now()
  };
}

const ERROR_CODES = {
  SUCCESS: 0,
  BAD_REQUEST: 40000,
  NOT_FOUND: 40400,
  CONFLICT: 40900,
  INTERNAL_ERROR: 50000,
  STATUS_TRANSITION_INVALID: 40010,
  BATCH_NOT_FOUND: 40401,
  PRESCRIPTION_NOT_FOUND: 40402,
  WORK_ORDER_NOT_FOUND: 40403,
  RETURN_NOT_FOUND: 40404,
  REASON_NOT_FOUND: 40405,
  RESPONSIBILITY_NOT_FOUND: 40406,
  BATCH_ALREADY_FINISHED: 40901,
  WORK_ORDER_NOT_FINISHED: 40902,
  RETURN_ALREADY_RESOLVED: 40903,
  RESPONSIBILITY_ALREADY_ASSIGNED: 40904,
  INVALID_RESPONSIBILITY_DEPARTMENT: 40011
};

module.exports = {
  success,
  error,
  ERROR_CODES
};
