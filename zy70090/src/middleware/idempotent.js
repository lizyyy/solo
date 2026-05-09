const pool = require('../database/pool');
const { ApiError } = require('../utils/response');

function idempotent(generateKey) {
  return async (req, res, next) => {
    try {
      const idempotencyKey = req.headers['x-idempotency-key'];
      
      if (!idempotencyKey) {
        return next();
      }

      const requestKey = generateKey ? generateKey(req) : idempotencyKey;

      const existingRequest = await pool.query(
        `SELECT status, response_body, expires_at 
         FROM idempotent_requests 
         WHERE request_key = $1`,
        [requestKey]
      );

      if (existingRequest.rows.length > 0) {
        const existing = existingRequest.rows[0];
        
        if (existing.expires_at && existing.expires_at < new Date()) {
          await pool.query(
            'DELETE FROM idempotent_requests WHERE request_key = $1',
            [requestKey]
          );
          return next();
        }

        if (existing.status === 'completed') {
          return res.status(200).json(existing.response_body);
        }

        if (existing.status === 'processing') {
          throw new ApiError('请求正在处理中，请稍后重试', 409, 'REQUEST_IN_PROGRESS');
        }
      }

      await pool.query(
        `INSERT INTO idempotent_requests 
         (request_key, request_type, request_body, status, operator_id, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          requestKey,
          `${req.method} ${req.path}`,
          JSON.stringify(req.body),
          'processing',
          req.operator?.id,
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        ]
      );

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        pool.query(
          `UPDATE idempotent_requests 
           SET status = 'completed', response_body = $1 
           WHERE request_key = $2`,
          [JSON.stringify(data), requestKey]
        ).catch(err => {
          console.error('Failed to update idempotent request:', err);
        });
        return originalJson(data);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { idempotent };
