import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';

const loggerOptions: pino.LoggerOptions = {
  level: process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
};

if (isProduction) {
  loggerOptions.base = { pid: process.pid };
}

export const logger = pino(loggerOptions);
