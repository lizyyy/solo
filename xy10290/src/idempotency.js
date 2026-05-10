const db = require('./database');
const { checksum } = require('./rules');

function findIdempotentRequest(requestId) {
  return db.prepare(`
    SELECT * FROM idempotent_requests WHERE request_id = ?
  `).get(requestId);
}

function saveIdempotentRequest(requestId, endpoint, input, output) {
  const now = Date.now();
  const inputJson = JSON.stringify(input);
  const outputJson = JSON.stringify(output);
  const cs = checksum({ input, output });
  
  db.prepare(`
    INSERT INTO idempotent_requests 
      (request_id, endpoint, input_json, output_json, created_at, checksum)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(requestId, endpoint, inputJson, outputJson, now, cs);
}

function idempotentMiddleware(endpoint) {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'];
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUEST_ID',
        message: '必须提供 X-Request-Id 头以保证幂等性'
      });
    }
    
    const existing = findIdempotentRequest(requestId);
    
    if (existing) {
      const inputCheck = checksum(req.body);
      const storedCheck = checksum(JSON.parse(existing.input_json));
      
      if (inputCheck !== storedCheck) {
        return res.status(409).json({
          success: false,
          error: 'IDEMPOTENT_MISMATCH',
          message: '相同 X-Request-Id 但请求体不同',
          cached_response: JSON.parse(existing.output_json)
        });
      }
      
      const cachedOutput = JSON.parse(existing.output_json);
      return res.status(cachedOutput._status || 200).json(
        Object.assign({}, cachedOutput, { _from_cache: true })
      );
    }
    
    req._idempotentRequestId = requestId;
    req._endpoint = endpoint;
    
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 500 && !body._from_cache) {
        try {
          saveIdempotentRequest(
            requestId,
            endpoint,
            req.body,
            Object.assign({}, body, { _status: res.statusCode })
          );
        } catch (e) {
          console.error('保存幂等请求失败:', e);
        }
      }
      return originalJson(body);
    };
    
    next();
  };
}

module.exports = {
  findIdempotentRequest,
  saveIdempotentRequest,
  idempotentMiddleware
};
