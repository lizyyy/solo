"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StableLogger = void 0;
const winston = __importStar(require("winston"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StableLogger {
    constructor(logFilePath, overwrite = true) {
        this.logFilePath = logFilePath;
        this.overwrite = overwrite;
        this.ensureLogDirectory();
        if (overwrite && fs.existsSync(logFilePath)) {
            fs.unlinkSync(logFilePath);
        }
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.json()),
            transports: [
                new winston.transports.File({
                    filename: logFilePath,
                    options: { flags: overwrite ? 'w' : 'a' }
                }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
    }
    ensureLogDirectory() {
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}
exports.StableLogger = StableLogger;
