function success(data = null, message = '操作成功') {
  return {
    code: 200,
    success: true,
    message,
    data
  };
}

function error(message = '操作失败', code = 500, data = null) {
  return {
    code,
    success: false,
    message,
    data
  };
}

function handleAsync(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      console.error('API Error:', err);
      res.status(500).json(error(err.message || '服务器内部错误'));
    }
  };
}

module.exports = {
  success,
  error,
  handleAsync
};