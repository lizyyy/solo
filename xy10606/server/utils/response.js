function success(data = null, message = '操作成功') {
  return {
    success: true,
    message,
    data
  };
}

function error(message = '操作失败', data = null, code = 400) {
  return {
    success: false,
    message,
    data,
    code
  };
}

module.exports = {
  success,
  error
};
