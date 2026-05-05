"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDate = parseDate;
exports.formatDate = formatDate;
exports.durationToMs = durationToMs;
exports.msToDuration = msToDuration;
function parseDate(dateStr) {
    const timestamp = Date.parse(dateStr);
    if (!isNaN(timestamp)) {
        return new Date(timestamp);
    }
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?/);
    if (isoMatch) {
        return new Date(dateStr);
    }
    const mysqlMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
    if (mysqlMatch) {
        return new Date(dateStr.replace(' ', 'T'));
    }
    const commonMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (commonMatch) {
        const [, day, month, year, hour, minute, second] = commonMatch;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
    return new Date();
}
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const pad = (n) => n.toString().padStart(2, '0');
    return format
        .replace('YYYY', date.getFullYear().toString())
        .replace('MM', pad(date.getMonth() + 1))
        .replace('DD', pad(date.getDate()))
        .replace('HH', pad(date.getHours()))
        .replace('mm', pad(date.getMinutes()))
        .replace('ss', pad(date.getSeconds()))
        .replace('SSS', date.getMilliseconds().toString().padStart(3, '0'));
}
function durationToMs(duration, unit = 'ms') {
    const numericValue = parseFloat(duration);
    if (isNaN(numericValue))
        return 0;
    switch (unit) {
        case 's':
            return numericValue * 1000;
        case 'us':
            return numericValue / 1000;
        case 'ms':
        default:
            return numericValue;
    }
}
function msToDuration(ms) {
    if (ms < 1) {
        return `${(ms * 1000).toFixed(2)}μs`;
    }
    if (ms < 1000) {
        return `${ms.toFixed(2)}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${(ms / 60000).toFixed(2)}min`;
}
//# sourceMappingURL=date-utils.js.map