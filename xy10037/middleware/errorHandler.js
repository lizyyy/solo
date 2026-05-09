const { error, BusinessError, ConcurrencyError } = require('./response');

function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  if (err instanceof BusinessError) {
    return res.status(err.code >= 400 && err.code < 500 ? 400 : 200).json(
      error(err.message, err.code)
    );
  }
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json(error('数据冲突，可能存在重复记录', 409));
    }
    return res.status(400).json(error('数据约束违反', 400));
  }
  
  return res.status(500).json(
    error(err.message || '服务器内部错误', 500)
  );
}

function notFoundHandler(req, res, next) {
  res.status(404).json(error('接口不存在', 404));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
