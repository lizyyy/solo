const { getDbSync } = require('../db/connection');

function idempotentMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || req.body.requestId;
  
  if (!requestId) {
    return next();
  }

  const endpoint = req.method + ':' + req.path;
  const db = getDbSync();
  
  const existing = db.prepare(
    'SELECT response FROM idempotent_requests WHERE request_id = ? AND endpoint = ?'
  ).get(requestId, endpoint);

  if (existing) {
    const cached = JSON.parse(existing.response);
    res.status(cached.status).json(cached.body);
    return;
  }

  res._originalJson = res.json.bind(res);
  res.json = function(body) {
    const response = JSON.stringify({
      status: res.statusCode,
      body: body
    });
    
    db.prepare(
      'INSERT INTO idempotent_requests (request_id, endpoint, response, created_at) VALUES (?, ?, ?, ?)'
    ).run(requestId, endpoint, response, new Date().toISOString());

    return res._originalJson(body);
  };

  next();
}

module.exports = idempotentMiddleware;
