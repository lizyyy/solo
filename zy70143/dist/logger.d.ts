import winston from 'winston';
export declare const logger: winston.Logger;
export declare const createAuditLogger: (module: string) => {
    info: (message: string, data?: Record<string, unknown>) => winston.Logger;
    warn: (message: string, data?: Record<string, unknown>) => winston.Logger;
    error: (message: string, data?: Record<string, unknown>) => winston.Logger;
    debug: (message: string, data?: Record<string, unknown>) => winston.Logger;
};
