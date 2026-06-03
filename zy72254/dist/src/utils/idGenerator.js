"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateObstructionId = generateObstructionId;
exports.generateHistoryId = generateHistoryId;
exports.generateRouteId = generateRouteId;
exports.generateRangefinderId = generateRangefinderId;
const uuid_1 = require("uuid");
function generateId(prefix = '') {
    return `${prefix}${(0, uuid_1.v4)()}`;
}
function generateObstructionId() {
    return generateId('obs_');
}
function generateHistoryId() {
    return generateId('hist_');
}
function generateRouteId() {
    return generateId('route_');
}
function generateRangefinderId() {
    return generateId('rf_');
}
//# sourceMappingURL=idGenerator.js.map