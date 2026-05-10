const logger = require('../services/logger');

function jsonBodyParser(req, res, next) {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return next();
  }
  
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
          error: 'Invalid JSON body',
          details: e.message
        });
      }
    } else {
      req.body = {};
    }
    next();
  });
}

function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}

function errorHandler(err, req, res, next) {
  logger.error('Request error', { 
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.url
  });
}

module.exports = {
  jsonBodyParser,
  requestLogger,
  errorHandler,
  notFoundHandler
};
