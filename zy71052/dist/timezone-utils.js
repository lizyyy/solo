"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToTimezone = convertToTimezone;
exports.formatDateInTimezone = formatDateInTimezone;
exports.parseDeprecationDate = parseDeprecationDate;
exports.isDatePast = isDatePast;
exports.getDaysUntilDeprecation = getDaysUntilDeprecation;
exports.isValidTimezone = isValidTimezone;
exports.getCurrentTimeInTimezone = getCurrentTimeInTimezone;
exports.getInspectionTimestamp = getInspectionTimestamp;
exports.getDeprecationStatus = getDeprecationStatus;
const luxon_1 = require("luxon");
function convertToTimezone(date, targetTimezone) {
    const dt = typeof date === 'string'
        ? luxon_1.DateTime.fromISO(date, { zone: 'utc' })
        : luxon_1.DateTime.fromJSDate(date, { zone: 'utc' });
    return dt.setZone(targetTimezone);
}
function formatDateInTimezone(date, timezone, format = 'yyyy-MM-dd HH:mm:ss') {
    return convertToTimezone(date, timezone).toFormat(format);
}
function parseDeprecationDate(dateStr, timezone) {
    return luxon_1.DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: timezone });
}
function isDatePast(dateStr, timezone, referenceDate) {
    const deprecationDate = parseDeprecationDate(dateStr, timezone);
    const now = referenceDate ? luxon_1.DateTime.fromJSDate(referenceDate) : luxon_1.DateTime.now();
    return now > deprecationDate;
}
function getDaysUntilDeprecation(dateStr, timezone, referenceDate) {
    const deprecationDate = parseDeprecationDate(dateStr, timezone);
    const now = referenceDate ? luxon_1.DateTime.fromJSDate(referenceDate) : luxon_1.DateTime.now();
    return Math.ceil(deprecationDate.diff(now, 'days').days);
}
function isValidTimezone(timezone) {
    return luxon_1.IANAZone.isValidZone(timezone);
}
function getCurrentTimeInTimezone(timezone) {
    return luxon_1.DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
}
function getInspectionTimestamp(timezone) {
    return luxon_1.DateTime.now().setZone(timezone).toISO() || new Date().toISOString();
}
function getDeprecationStatus(deprecationDate, timezone) {
    if (!deprecationDate) {
        return {
            isExpired: false,
            daysUntil: Infinity,
            formattedDate: '未指定',
            timezone,
        };
    }
    const daysUntil = getDaysUntilDeprecation(deprecationDate, timezone);
    return {
        isExpired: daysUntil <= 0,
        daysUntil,
        formattedDate: parseDeprecationDate(deprecationDate, timezone).toFormat('yyyy-MM-dd'),
        timezone,
    };
}
//# sourceMappingURL=timezone-utils.js.map