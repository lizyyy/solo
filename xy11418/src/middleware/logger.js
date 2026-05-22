const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../data/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const accessLogStream = fs.createWriteStream(
  path.join(logDir, 'access.log'),
  { flags: 'a' }
);

const logger = morgan('combined', { stream: accessLogStream });

const consoleLogger = morgan(':method :url :status :response-time ms - :res[content-length]');

module.exports = { logger, consoleLogger };
