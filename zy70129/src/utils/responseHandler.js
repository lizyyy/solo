function success(data = null, message = '操作成功') {
  return {
    success: true,
    code: 200,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

function error(message = '操作失败', code = 500, data = null) {
  return {
    success: false,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

function validationError(errors, message = '参数校验失败') {
  return {
    success: false,
    code: 400,
    message,
    errors,
    timestamp: new Date().toISOString()
  };
}

function notFound(message = '资源不存在') {
  return {
    success: false,
    code: 404,
    message,
    timestamp: new Date().toISOString()
  };
}

function conflict(message = '资源冲突') {
  return {
    success: false,
    code: 409,
    message,
    timestamp: new Date().toISOString()
  };
}

function unauthorized(message = '未授权访问') {
  return {
    success: false,
    code: 401,
    message,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  success,
  error,
  validationError,
  notFound,
  conflict,
  unauthorized
};
