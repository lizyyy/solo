import type { ExecutionLogEntry } from '../types/index.js';
export declare class ExecutionLogger {
    private logs;
    private maxLogs;
    constructor(maxLogs?: number);
    log(action: string, success: boolean, message: string, details?: unknown): ExecutionLogEntry;
    success(action: string, message: string, details?: unknown): ExecutionLogEntry;
    error(action: string, message: string, details?: unknown): ExecutionLogEntry;
    getLogs(): ExecutionLogEntry[];
    getErrors(): ExecutionLogEntry[];
    getSuccesses(): ExecutionLogEntry[];
    getByAction(action: string): ExecutionLogEntry[];
    getRecent(count?: number): ExecutionLogEntry[];
    clear(): void;
    getStats(): {
        total: number;
        success: number;
        error: number;
        successRate: number;
    };
    export(format: 'json' | 'csv'): string;
}
//# sourceMappingURL=index.d.ts.map