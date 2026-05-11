const idempotencyService = require('../services/idempotencyService');

const IDEMPOTENCY_REQUIRED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const IDEMPOTENCY_REQUIRED_PATHS = [
  /^\/api\/inventory(\/|$)/,
  /^\/api\/inventory\/[^/]+\/(adjust|price)(\/|$)/,
  /^\/api\/inventory\/transfer(\/|$)/
];

function pathRequiresIdempotency(path, method) {
  if (!IDEMPOTENCY_REQUIRED_METHODS.includes(method)) {
    return false;
  }
  return IDEMPOTENCY_REQUIRED_PATHS.some(pattern => pattern.test(path));
}

function idempotencyMiddleware(req, res, next) {
  if (!pathRequiresIdempotency(req.path, req.method)) {
    return next();
  }

  const requestId = req.headers['x-request-id'];
  
  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: '缺少请求ID，请在请求头中添加 X-Request-ID'
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    return res.status(400).json({
      success: false,
      message: '无效的请求ID格式，必须是有效的UUID'
    });
  }

  req.requestId = requestId;
  next();
}

async function checkRequestProcessed(req, res, next) {
  const requestId = req.requestId;
  if (!requestId) return next();

  try {
    const check = await idempotencyService.isRequestProcessed(requestId);
    
    if (check.processed) {
      return res.json({
        ...check.result,
        isDuplicate: check.isDuplicate
      });
    }

    if (check.isProcessing) {
      return res.status(409).json({
        success: false,
        message: '请求正在处理中，请稍后重试',
        isProcessing: true
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = idempotencyMiddleware;
module.exports.checkRequestProcessed = checkRequestProcessed;
