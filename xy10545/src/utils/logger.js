const log = (level, message, data = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(entry));
};

module.exports = {
  info: (msg, data) => log('INFO', msg, data),
  warn: (msg, data) => log('WARN', msg, data),
  error: (msg, data) => log('ERROR', msg, data),
  debug: (msg, data) => log('DEBUG', msg, data)
};
