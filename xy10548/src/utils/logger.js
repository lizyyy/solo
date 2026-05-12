function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(prefix, message, ...args);
}

module.exports = {
  info: (message, ...args) => log('info', message, ...args),
  success: (message, ...args) => log('success', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  error: (message, ...args) => log('error', message, ...args),
  debug: (message, ...args) => {
    if (process.env.DEBUG) {
      log('debug', message, ...args);
    }
  }
};
