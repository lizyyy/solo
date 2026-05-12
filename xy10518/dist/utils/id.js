"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateBatchNumber = generateBatchNumber;
exports.generateSheetNumber = generateSheetNumber;
exports.getTimestamp = getTimestamp;
const uuid_1 = require("uuid");
function generateId() {
    return (0, uuid_1.v4)();
}
function generateBatchNumber(prefix = 'B') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${year}${month}${day}${random}`;
}
function generateSheetNumber(batchNumber, sequence = 1) {
    return `${batchNumber}-S${String(sequence).padStart(3, '0')}`;
}
function getTimestamp() {
    return new Date().toISOString();
}
//# sourceMappingURL=id.js.map