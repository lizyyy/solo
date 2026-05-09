const config = require('../config');

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = config.nodeEnv === 'production' ? 'info' : 'debug';
const currentLevelValue = levels[currentLevel];

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (args.length > 0) {
    console.log(prefix, message, ...args);
  } else {
    console.log(prefix, message);
  }
}

module.exports = {
  debug: (message, ...args) => {
    if (currentLevelValue <= levels.debug) {
      formatMessage('debug', message, ...args);
    }
  },
  info: (message, ...args) => {
    if (currentLevelValue <= levels.info) {
      formatMessage('info', message, ...args);
    }
  },
  warn: (message, ...args) => {
    if (currentLevelValue <= levels.warn) {
      formatMessage('warn', message, ...args);
    }
  },
  error: (message, ...args) => {
    if (currentLevelValue <= levels.error) {
      formatMessage('error', message, ...args);
    }
  },
};
