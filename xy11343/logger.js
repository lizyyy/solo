const winston = require('winston');
const { maskLog } = require('./middleware/dataMasking');

const maskedFormat = winston.format((info) => {
  const { message, meta } = maskLog(info.message, info.meta);
  info.message = message;
  if (meta) {
    info.meta = meta;
  }
  return info;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    maskedFormat(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      maskedFormat(),
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
