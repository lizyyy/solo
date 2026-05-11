"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOperation = logOperation;
exports.logInfo = logInfo;
exports.logError = logError;
exports.logWarn = logWarn;
exports.getLogs = getLogs;
exports.cleanupOldLogs = cleanupOldLogs;
const index_1 = require("../database/index");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
async function logOperation(level, module, action, userId, userName, details, success, errorMessage = null, duration = 0) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const log = {
        id: (0, utils_1.generateId)(),
        level,
        module,
        action,
        userId,
        userName,
        details,
        success,
        errorMessage,
        duration,
        timestamp: now
    };
    await (0, index_1.run)(`
    INSERT INTO system_logs (
      id, level, module, action, user_id, user_name, details,
      success, error_message, duration, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        log.id,
        log.level,
        log.module,
        log.action,
        log.userId,
        log.userName,
        log.details,
        log.success ? 1 : 0,
        log.errorMessage,
        log.duration,
        log.timestamp
    ]);
    return log;
}
async function logInfo(module, action, userId, userName, details) {
    return logOperation(types_1.LogLevel.INFO, module, action, userId, userName, details, true);
}
async function logError(module, action, userId, userName, details, error) {
    return logOperation(types_1.LogLevel.ERROR, module, action, userId, userName, details, false, error.message);
}
async function logWarn(module, action, userId, userName, details) {
    return logOperation(types_1.LogLevel.WARN, module, action, userId, userName, details, true);
}
async function getLogs(params) {
    const { page, pageSize, sortBy = 'timestamp', sortOrder = 'desc', level, module, startDate, endDate } = params;
    const whereClauses = [];
    const whereParams = [];
    if (level) {
        whereClauses.push('level = ?');
        whereParams.push(level);
    }
    if (module) {
        whereClauses.push('module = ?');
        whereParams.push(module);
    }
    if (startDate) {
        whereClauses.push('timestamp >= ?');
        whereParams.push(startDate);
    }
    if (endDate) {
        whereClauses.push('timestamp <= ?');
        whereParams.push(endDate);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await (0, index_1.get)(`SELECT COUNT(*) as count FROM system_logs ${whereSql}`, whereParams);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM system_logs ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [...whereParams, pageSize, offset]);
    return {
        items: rows.map(mapLog),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
async function cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const result = await (0, index_1.run)('DELETE FROM system_logs WHERE timestamp < ?', [cutoffDate.toISOString()]);
    return result.changes;
}
function mapLog(row) {
    return {
        id: row.id,
        level: row.level,
        module: row.module,
        action: row.action,
        userId: row.user_id,
        userName: row.user_name,
        details: row.details,
        success: row.success === 1,
        errorMessage: row.error_message,
        duration: row.duration,
        timestamp: row.timestamp
    };
}
//# sourceMappingURL=logService.js.map