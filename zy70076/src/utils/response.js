const success = (data, message = '操作成功', code = 200) => ({
  code,
  success: true,
  message,
  data,
});

const error = (message, code = 400, details = null) => ({
  code,
  success: false,
  message,
  details,
});

const businessSuccess = (businessCode, data, message) => ({
  ...success(data, message),
  businessCode,
});

const businessError = (businessCode, message, details = null) => ({
  ...error(message, 400, details),
  businessCode,
});

module.exports = {
  success,
  error,
  businessSuccess,
  businessError,
};
