"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.now = now;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
exports.isSameDay = isSameDay;
exports.isAfter = isAfter;
exports.isBefore = isBefore;
exports.addDays = addDays;
exports.fileHash = fileHash;
exports.stringHash = stringHash;
exports.validatePhone = validatePhone;
exports.validateIdCard = validateIdCard;
exports.validatePlateNumber = validatePlateNumber;
exports.truncateString = truncateString;
exports.safeJsonParse = safeJsonParse;
exports.safeJsonStringify = safeJsonStringify;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
function generateId() {
    return (0, uuid_1.v4)();
}
function now() {
    return (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss');
}
function formatDate(date) {
    return (0, dayjs_1.default)(date).format('YYYY-MM-DD HH:mm:ss');
}
function parseDate(dateStr) {
    return (0, dayjs_1.default)(dateStr);
}
function isSameDay(date1, date2) {
    return (0, dayjs_1.default)(date1).isSame((0, dayjs_1.default)(date2), 'day');
}
function isAfter(date1, date2) {
    return (0, dayjs_1.default)(date1).isAfter((0, dayjs_1.default)(date2));
}
function isBefore(date1, date2) {
    return (0, dayjs_1.default)(date1).isBefore((0, dayjs_1.default)(date2));
}
function addDays(date, days) {
    return (0, dayjs_1.default)(date).add(days, 'day').format('YYYY-MM-DD HH:mm:ss');
}
function fileHash(filePath) {
    const fileBuffer = fs_1.default.readFileSync(filePath);
    const hashSum = crypto_1.default.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
function stringHash(str) {
    return crypto_1.default.createHash('sha256').update(str).digest('hex');
}
function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}
function validateIdCard(idCard) {
    const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return reg.test(idCard);
}
function validatePlateNumber(plate) {
    const reg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
    return reg.test(plate);
}
function truncateString(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength) + '...';
}
function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    }
    catch {
        return defaultValue;
    }
}
function safeJsonStringify(obj) {
    try {
        return JSON.stringify(obj);
    }
    catch {
        return '{}';
    }
}
