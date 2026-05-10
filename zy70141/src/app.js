require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later',
    });
  },
});

app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  req.requestId = require('uuid').v4();
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    requestId: req.requestId,
  });
  
  const originalSend = res.send;
  res.send = function(...args) {
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      requestId: req.requestId,
    });
    return originalSend.apply(this, args);
  };
  
  next();
});

app.use('/', routes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
  });
  
  res.status(500).json({
    success: false,
    error: 'internal_error',
    message: 'An unexpected error occurred',
    requestId: req.requestId,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'not_found',
    message: 'Resource not found',
  });
});

module.exports = app;
