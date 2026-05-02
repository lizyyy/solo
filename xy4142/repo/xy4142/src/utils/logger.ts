import winston from 'winston';
import chalk from 'chalk';

const { combine, timestamp, printf, colorize, json } = winston.format;

const customFormat = printf(({ level, message, timestamp, module, ...meta }) => {
  const timestampStr = timestamp ? `[${timestamp}]` : '';
  const moduleStr = module ? `[${module}]` : '';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestampStr} ${moduleStr} ${level}: ${message}${metaStr}`;
});

const createLogger = (moduleName?: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      json()
    ),
    defaultMeta: { module: moduleName },
    transports: [
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          customFormat
        )
      })
    ]
  });
};

export const logger = createLogger('main');
export { createLogger };
