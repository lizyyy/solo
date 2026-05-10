"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeWindowRange = getTimeWindowRange;
exports.calculateTimeWindowDurationMs = calculateTimeWindowDurationMs;
exports.isRollingWindow = isRollingWindow;
const dayjs_1 = __importDefault(require("dayjs"));
const enums_1 = require("../types/enums");
function getTimeWindowRange(windowType, referenceTime) {
    const now = referenceTime ? (0, dayjs_1.default)(referenceTime) : (0, dayjs_1.default)();
    switch (windowType) {
        case enums_1.TimeWindowType.DAILY:
            return {
                start: now.startOf('day').toDate(),
                end: now.endOf('day').toDate(),
            };
        case enums_1.TimeWindowType.WEEKLY:
            return {
                start: now.startOf('week').toDate(),
                end: now.endOf('week').toDate(),
            };
        case enums_1.TimeWindowType.MONTHLY:
            return {
                start: now.startOf('month').toDate(),
                end: now.endOf('month').toDate(),
            };
        case enums_1.TimeWindowType.ROLLING_24H:
            return {
                start: now.subtract(24, 'hour').toDate(),
                end: now.toDate(),
            };
        case enums_1.TimeWindowType.ROLLING_7D:
            return {
                start: now.subtract(7, 'day').toDate(),
                end: now.toDate(),
            };
        case enums_1.TimeWindowType.ROLLING_30D:
            return {
                start: now.subtract(30, 'day').toDate(),
                end: now.toDate(),
            };
        default:
            return {
                start: now.startOf('day').toDate(),
                end: now.endOf('day').toDate(),
            };
    }
}
function calculateTimeWindowDurationMs(windowType) {
    const durations = {
        [enums_1.TimeWindowType.DAILY]: 24 * 60 * 60 * 1000,
        [enums_1.TimeWindowType.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
        [enums_1.TimeWindowType.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
        [enums_1.TimeWindowType.ROLLING_24H]: 24 * 60 * 60 * 1000,
        [enums_1.TimeWindowType.ROLLING_7D]: 7 * 24 * 60 * 60 * 1000,
        [enums_1.TimeWindowType.ROLLING_30D]: 30 * 24 * 60 * 60 * 1000,
    };
    return durations[windowType];
}
function isRollingWindow(windowType) {
    return [
        enums_1.TimeWindowType.ROLLING_24H,
        enums_1.TimeWindowType.ROLLING_7D,
        enums_1.TimeWindowType.ROLLING_30D,
    ].includes(windowType);
}
//# sourceMappingURL=timeWindow.js.map