export class ExecutionLogger {
    constructor(maxLogs = 1000) {
        this.logs = [];
        this.maxLogs = 1000;
        this.maxLogs = maxLogs;
    }
    log(action, success, message, details) {
        const entry = {
            timestamp: Date.now(),
            action,
            success,
            message,
            details,
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        return entry;
    }
    success(action, message, details) {
        return this.log(action, true, message, details);
    }
    error(action, message, details) {
        return this.log(action, false, message, details);
    }
    getLogs() {
        return [...this.logs];
    }
    getErrors() {
        return this.logs.filter(log => !log.success);
    }
    getSuccesses() {
        return this.logs.filter(log => log.success);
    }
    getByAction(action) {
        return this.logs.filter(log => log.action === action);
    }
    getRecent(count = 50) {
        return this.logs.slice(-count);
    }
    clear() {
        this.logs = [];
    }
    getStats() {
        const total = this.logs.length;
        const success = this.logs.filter(l => l.success).length;
        const error = total - success;
        const successRate = total > 0 ? (success / total) * 100 : 0;
        return { total, success, error, successRate };
    }
    export(format) {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        }
        const headers = ['timestamp', 'action', 'success', 'message', 'details'];
        const csvLines = [headers.join(',')];
        for (const log of this.logs) {
            const line = [
                log.timestamp,
                `"${log.action.replace(/"/g, '""')}"`,
                log.success,
                `"${log.message.replace(/"/g, '""')}"`,
                log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ''
            ].join(',');
            csvLines.push(line);
        }
        return csvLines.join('\n');
    }
}
//# sourceMappingURL=index.js.map