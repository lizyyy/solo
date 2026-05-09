"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.colors = void 0;
exports.printTable = printTable;
exports.printSuccess = printSuccess;
exports.printError = printError;
exports.printWarning = printWarning;
exports.printInfo = printInfo;
exports.printHeader = printHeader;
exports.getSeverityColor = getSeverityColor;
exports.getDiffTypeLabel = getDiffTypeLabel;
const table_1 = require("table");
exports.colors = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    magenta: (text) => `\x1b[35m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
    dim: (text) => `\x1b[2m${text}\x1b[0m`
};
function printTable(rows, header) {
    if (header) {
        rows.unshift(header);
    }
    const config = {
        border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼'
        }
    };
    console.log((0, table_1.table)(rows, config));
}
function printSuccess(message) {
    console.log(`${exports.colors.green('✅')} ${message}`);
}
function printError(message) {
    console.error(`${exports.colors.red('❌')} ${message}`);
}
function printWarning(message) {
    console.warn(`${exports.colors.yellow('⚠️')} ${message}`);
}
function printInfo(message) {
    console.log(`${exports.colors.blue('ℹ️')} ${message}`);
}
function printHeader(title) {
    console.log('');
    console.log(exports.colors.bold(exports.colors.cyan(title)));
    console.log(exports.colors.cyan('─'.repeat(title.length * 2)));
}
function getSeverityColor(severity) {
    switch (severity) {
        case 'critical': return exports.colors.red;
        case 'high': return exports.colors.yellow;
        case 'medium': return exports.colors.magenta;
        case 'low': return exports.colors.blue;
        default: return exports.colors.gray;
    }
}
function getDiffTypeLabel(type) {
    switch (type) {
        case 'added': return exports.colors.green('➕ 新增');
        case 'removed': return exports.colors.red('➖ 删除');
        case 'modified': return exports.colors.yellow('🔄 修改');
        case 'unchanged': return exports.colors.gray('✅ 一致');
        default: return type;
    }
}
