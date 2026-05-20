"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMedicationExpired = exports.isMedicationExpiringSoon = exports.isFever = exports.daysBetween = exports.isDateValid = exports.parseDate = exports.formatDate = exports.generateId = void 0;
const uuid_1 = require("uuid");
const constants_1 = require("../constants");
const generateId = () => {
    return (0, uuid_1.v4)();
};
exports.generateId = generateId;
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};
exports.formatDate = formatDate;
const parseDate = (dateStr) => {
    return new Date(dateStr);
};
exports.parseDate = parseDate;
const isDateValid = (dateStr) => {
    const date = (0, exports.parseDate)(dateStr);
    return !isNaN(date.getTime());
};
exports.isDateValid = isDateValid;
const daysBetween = (date1, date2) => {
    const d1 = (0, exports.parseDate)(date1);
    const d2 = (0, exports.parseDate)(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
exports.daysBetween = daysBetween;
const isFever = (temperature) => {
    return temperature >= constants_1.FEVER_THRESHOLD;
};
exports.isFever = isFever;
const isMedicationExpiringSoon = (expiryDate, checkDate) => {
    const days = (0, exports.daysBetween)(expiryDate, checkDate);
    return days <= constants_1.MEDICATION_EXPIRY_WARNING_DAYS;
};
exports.isMedicationExpiringSoon = isMedicationExpiringSoon;
const isMedicationExpired = (expiryDate, checkDate) => {
    const expiry = (0, exports.parseDate)(expiryDate);
    const check = (0, exports.parseDate)(checkDate);
    return check > expiry;
};
exports.isMedicationExpired = isMedicationExpired;
