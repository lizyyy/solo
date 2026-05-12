"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStartOfMonth = getStartOfMonth;
exports.getEndOfMonth = getEndOfMonth;
exports.getStartOfYear = getStartOfYear;
exports.getEndOfYear = getEndOfYear;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.parseDate = parseDate;
exports.addMonths = addMonths;
exports.diffInMonths = diffInMonths;
exports.isSameMonth = isSameMonth;
exports.isDateInRange = isDateInRange;
exports.getCurrentDate = getCurrentDate;
exports.getCurrentDateTime = getCurrentDateTime;
function getStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}
function getEndOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function getStartOfYear(date) {
    return new Date(date.getFullYear(), 0, 1);
}
function getEndOfYear(date) {
    return new Date(date.getFullYear(), 11, 31);
}
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function parseDate(dateStr) {
    const parts = dateStr.split(/[-T ]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
}
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}
function diffInMonths(date1, date2) {
    const yearDiff = date2.getFullYear() - date1.getFullYear();
    const monthDiff = date2.getMonth() - date1.getMonth();
    return yearDiff * 12 + monthDiff;
}
function isSameMonth(date1, date2) {
    return (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth());
}
function isDateInRange(date, start, end) {
    return date >= start && date <= end;
}
function getCurrentDate() {
    return new Date();
}
function getCurrentDateTime() {
    return formatDateTime(new Date());
}
//# sourceMappingURL=date.js.map