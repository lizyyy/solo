"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let logMessage = `${timestamp} [${level}]: ${stack || message}`;
    if (Object.keys(metadata).length > 0) {
        logMessage += ` ${JSON.stringify(metadata)}`;
    }
    return logMessage;
});
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat)
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log'
        })
    ]
});
const createAuditLogger = (module) => ({
    info: (message, data) => exports.logger.info(`[${module}] ${message}`, data),
    warn: (message, data) => exports.logger.warn(`[${module}] ${message}`, data),
    error: (message, data) => exports.logger.error(`[${module}] ${message}`, data),
    debug: (message, data) => exports.logger.debug(`[${module}] ${message}`, data)
});
exports.createAuditLogger = createAuditLogger;
//# sourceMappingURL=logger.js.map