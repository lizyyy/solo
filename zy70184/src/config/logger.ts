import { createLogger, format, transports } from 'winston';
import { isProduction } from './env';

const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

export const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: customFormat,
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      ),
    }),
  ],
});

export default logger;
