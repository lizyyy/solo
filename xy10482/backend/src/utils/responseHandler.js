const success = (res, data, message = '操作成功') => {
  res.status(200).json({
    success: true,
    message,
    data
  });
};

const error = (res, message = '操作失败', statusCode = 400) => {
  res.status(statusCode).json({
    success: false,
    message,
    data: null
  });
};

const serverError = (res, err) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
};

module.exports = {
  success,
  error,
  serverError
};
