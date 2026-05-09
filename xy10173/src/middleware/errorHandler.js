const { ApiError } = require('../errors/ApiError');

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  
  if (err instanceof ApiError) {
    return res.status(err.httpStatus).json(err.toJSON());
  }
  
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误'
    }
  });
}

function jsonBodyParser(req, res, next) {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    if (data) {
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: '无效的 JSON 格式'
          }
        });
      }
    } else {
      req.body = {};
    }
    next();
  });
}

module.exports = { errorHandler, jsonBodyParser };
