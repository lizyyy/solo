function success(data, message = '操作成功') {
  return {
    success: true,
    message,
    data
  };
}

function error(message, code = 400) {
  return {
    success: false,
    error: message,
    code
  };
}

module.exports = { success, error };
