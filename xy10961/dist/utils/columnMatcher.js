"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findColumn = findColumn;
exports.findColumnByConfig = findColumnByConfig;
exports.getColumnValue = getColumnValue;
const default_1 = require("../config/default");
function findColumn(headers, columnTypes) {
    for (const columnType of columnTypes) {
        const found = headers.find(h => h.toLowerCase().includes(columnType.toLowerCase()) ||
            columnType.toLowerCase().includes(h.toLowerCase()));
        if (found)
            return found;
    }
    return null;
}
function findColumnByConfig(headers, configKey) {
    const columnTypes = default_1.defaultConfig.列名映射[configKey];
    return findColumn(headers, columnTypes);
}
function getColumnValue(row, headers, configKey) {
    const columnName = findColumnByConfig(headers, configKey);
    if (!columnName)
        return '';
    const value = row[columnName];
    return value !== undefined && value !== null ? String(value).trim() : '';
}
