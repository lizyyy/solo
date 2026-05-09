const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.clientId = req.headers['x-client-id'] || null;
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = requestIdMiddleware;
