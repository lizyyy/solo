const success = (data, message = '操作成功') => ({
  code: 0,
  message,
  data,
  timestamp: Date.now()
});

const error = (message, code = 500, data = null) => ({
  code,
  message,
  data,
  timestamp: Date.now()
});

module.exports = {
  success,
  error
};
