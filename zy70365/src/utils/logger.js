const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_TYPES = {
  SYSTEM: 'system',
  USER: 'user',
  PLATFORM: 'platform',
  AUDIT: 'audit'
};

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'sandbox-api' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),
    new transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    })
  ]
});

class TaskLogger {
  constructor(taskId) {
    this.taskId = taskId;
    this.logs = [];
  }

  log(type, level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      taskId: this.taskId,
      type,
      level,
      message,
      ...meta
    };
    this.logs.push(logEntry);
    logger[level](message, { taskId: this.taskId, type, ...meta });
    return logEntry;
  }

  user(message, meta = {}) {
    return this.log(LOG_TYPES.USER, 'info', message, meta);
  }

  platform(message, meta = {}) {
    return this.log(LOG_TYPES.PLATFORM, 'warn', message, meta);
  }

  system(message, meta = {}) {
    return this.log(LOG_TYPES.SYSTEM, 'info', message, meta);
  }

  audit(action, operator, details = {}) {
    return this.log(LOG_TYPES.AUDIT, 'info', `Audit: ${action}`, {
      action,
      operator,
      details,
      auditTimestamp: new Date().toISOString()
    });
  }

  getLogs(typeFilter = null) {
    if (!typeFilter) return [...this.logs];
    return this.logs.filter(log => log.type === typeFilter);
  }
}

module.exports = {
  logger,
  TaskLogger,
  LOG_TYPES
};
