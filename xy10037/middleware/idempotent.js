const db = require('../database/connection');
const config = require('../config');
const { success, error, DuplicateRequestError } = require('./response');

async function checkIdempotent(requestId, action, targetId = null) {
  const existing = await db.get(
    'SELECT * FROM idempotent_requests WHERE request_id = ?',
    [requestId]
  );
  
  if (existing) {
    return {
      isDuplicate: true,
      response: existing.response ? JSON.parse(existing.response) : null
    };
  }
  
  const now = Date.now();
  await db.run(
    `INSERT INTO idempotent_requests (request_id, action, target_id, response, created_at, expires_at)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    [requestId, action, targetId, now, now + config.IDEMPOTENT_TTL]
  );
  
  return { isDuplicate: false, response: null };
}

async function saveIdempotentResponse(requestId, response) {
  await db.run(
    'UPDATE idempotent_requests SET response = ? WHERE request_id = ?',
    [JSON.stringify(response), requestId]
  );
}

function idempotentMiddleware(actionExtractor) {
  return async (req, res, next) => {
    const requestId = req.headers['x-request-id'] || req.body.requestId;
    
    if (!requestId) {
      return next();
    }
    
    const action = typeof actionExtractor === 'function' 
      ? actionExtractor(req) 
      : `${req.method}:${req.path}`;
    
    const targetId = req.params.id || null;
    
    try {
      const result = await checkIdempotent(requestId, action, targetId);
      
      if (result.isDuplicate) {
        if (result.response) {
          return res.json(result.response);
        } else {
          throw new DuplicateRequestError('请求正在处理中，请稍候再试');
        }
      }
      
      res.locals.requestId = requestId;
      res.locals.saveIdempotentResponse = (response) => 
        saveIdempotentResponse(requestId, response);
      
      next();
    } catch (err) {
      next(err);
    }
  };
}

function wrapResponse(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res);
      const response = success(result);
      
      if (res.locals.saveIdempotentResponse) {
        await res.locals.saveIdempotentResponse(response);
      }
      
      res.json(response);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  checkIdempotent,
  saveIdempotentResponse,
  idempotentMiddleware,
  wrapResponse
};
