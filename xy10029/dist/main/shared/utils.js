"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.getCurrentTimestamp = getCurrentTimestamp;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
exports.isValidDeviceTransition = isValidDeviceTransition;
exports.createDeviceHistory = createDeviceHistory;
exports.createSystemLog = createSystemLog;
exports.createFailedOperation = createFailedOperation;
exports.calculateNextRetry = calculateNextRetry;
exports.serializeSnapshot = serializeSnapshot;
exports.deserializeSnapshot = deserializeSnapshot;
exports.maskPassword = maskPassword;
exports.truncateText = truncateText;
const types_1 = require("./types");
const uuid_1 = require("uuid");
function generateId() {
    return (0, uuid_1.v4)();
}
function getCurrentTimestamp() {
    return new Date().toISOString();
}
function formatDate(date) {
    return date.toISOString();
}
function parseDate(dateString) {
    return new Date(dateString);
}
function isValidDeviceTransition(currentStatus, nextStatus, transitions) {
    return transitions[currentStatus]?.includes(nextStatus) || false;
}
function createDeviceHistory(device, changeType, userId, userName, description, version) {
    return {
        id: generateId(),
        deviceId: device.id,
        version,
        snapshot: JSON.stringify(device),
        changedAt: getCurrentTimestamp(),
        changedBy: userId,
        changedByName: userName,
        changeType,
        description
    };
}
function createSystemLog(level, module, action, userId, userName, details, success, errorMessage = null, duration = 0) {
    return {
        id: generateId(),
        level,
        module,
        action,
        userId,
        userName,
        details,
        success,
        errorMessage,
        duration,
        timestamp: getCurrentTimestamp()
    };
}
function createFailedOperation(operationType, details, errorMessage, maxRetries = 3) {
    const now = getCurrentTimestamp();
    return {
        id: generateId(),
        operationType,
        details,
        errorMessage,
        retryCount: 0,
        maxRetries,
        status: types_1.RetryStatus.PENDING,
        lastAttemptAt: now,
        nextRetryAt: calculateNextRetry(0, now),
        createdAt: now
    };
}
function calculateNextRetry(retryCount, lastAttemptAt) {
    const baseDelay = 5000;
    const delay = baseDelay * Math.pow(2, retryCount);
    const lastAttempt = parseDate(lastAttemptAt);
    return formatDate(new Date(lastAttempt.getTime() + delay));
}
function serializeSnapshot(data) {
    return JSON.stringify(data, null, 2);
}
function deserializeSnapshot(snapshot) {
    return JSON.parse(snapshot);
}
function maskPassword(password) {
    return '*'.repeat(password.length);
}
function truncateText(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 3) + '...';
}
//# sourceMappingURL=utils.js.map