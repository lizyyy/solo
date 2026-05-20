const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../database');
const logger = require('../utils/logger');

const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';
const EXPIRY_HOURS = 24;

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER];

  if (!idempotencyKey) {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      return res.status(400).json({
        success: false,
        error: '缺少幂等性键',
        message: `请在请求头中提供 ${IDEMPOTENCY_KEY_HEADER}`
      });
    }
    return next();
  }

  try {
    const existing = await get(
      'SELECT * FROM idempotency_keys WHERE key = ? AND request_method = ? AND request_path = ?',
      [idempotencyKey, req.method, req.path]
    );

    if (existing) {
      logger.info('检测到重复请求，返回缓存响应', {
        idempotencyKey,
        method: req.method,
        path: req.path
      });

      let responseBody;
      try {
        responseBody = JSON.parse(existing.response_body);
      } catch {
        responseBody = existing.response_body;
      }

      return res.status(existing.response_status).json(responseBody);
    }

    const originalJson = res.json;
    res.json = async function(body) {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + EXPIRY_HOURS);

        await run(
          `INSERT INTO idempotency_keys (id, key, request_method, request_path, response_body, response_status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            idempotencyKey,
            req.method,
            req.path,
            typeof body === 'string' ? body : JSON.stringify(body),
            res.statusCode,
            expiresAt.toISOString()
          ]
        );
      } catch (err) {
        logger.error('保存幂等性响应失败', { error: err.message });
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    logger.error('幂等性检查失败', { error: err.message });
    next();
  }
};

const cleanupExpiredKeys = async () => {
  try {
    await run(
      'DELETE FROM idempotency_keys WHERE expires_at < ?',
      [new Date().toISOString()]
    );
    logger.info('已清理过期的幂等性键');
  } catch (err) {
    logger.error('清理过期幂等性键失败', { error: err.message });
  }
};

setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

module.exports = idempotencyMiddleware;
