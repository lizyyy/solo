"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueryString = getQueryString;
exports.getQueryNumber = getQueryNumber;
exports.getParamString = getParamString;
function getQueryString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return getQueryString(value[0]);
    }
    if (typeof value === 'object') {
        return undefined;
    }
    return String(value);
}
function getQueryNumber(value) {
    const str = getQueryString(value);
    if (str === undefined) {
        return undefined;
    }
    const num = parseInt(str);
    return isNaN(num) ? undefined : num;
}
function getParamString(value) {
    if (Array.isArray(value)) {
        return String(value[0]);
    }
    return String(value);
}
