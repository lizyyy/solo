const db = require('../models/database');
const { hashRequest } = require('../utils/helpers');
const moment = require('moment');

function getIdempotencyMiddleware(expireHours = 24) {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    if (!idempotencyKey) {
      return res.status(400).json({
        error: '缺少幂等性键',
        message: '请在请求头中提供 X-Idempotency-Key'
      });
    }

    const requestHash = hashRequest({
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query
    });

    try {
      const existingKey = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM idempotency_keys WHERE idempotency_key = ?',
          [idempotencyKey],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (existingKey) {
        if (existingKey.request_hash === requestHash) {
          if (existingKey.response_data) {
            const cachedResponse = JSON.parse(existingKey.response_data);
            return res.status(cachedResponse.status || 200).json(cachedResponse.data);
          }
        } else {
          return res.status(409).json({
            error: '幂等性键冲突',
            message: '该幂等性键已用于不同的请求'
          });
        }
      } else {
        const expiresAt = moment().add(expireHours, 'hours').format('YYYY-MM-DD HH:mm:ss');
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO idempotency_keys (idempotency_key, request_hash, expires_at) VALUES (?, ?, ?)',
            [idempotencyKey, requestHash, expiresAt],
            (err) => err ? reject(err) : resolve()
          );
        });
      }

      res.sendIdempotentResponse = (status, data) => {
        const responseData = JSON.stringify({ status, data });
        db.run(
          'UPDATE idempotency_keys SET response_data = ? WHERE idempotency_key = ?',
          [responseData, idempotencyKey]
        );
        res.status(status).json(data);
      };

      next();
    } catch (error) {
      console.error('幂等性检查错误:', error);
      res.status(500).json({ error: '内部服务器错误' });
    }
  };
}

module.exports = getIdempotencyMiddleware;
