"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewStatus = exports.DiscrepancyType = exports.SampleStatus = void 0;
exports.getPrimaryDiscrepancy = getPrimaryDiscrepancy;
exports.getAllDiscrepancyTypes = getAllDiscrepancyTypes;
exports.getAllDiscrepancyDescriptions = getAllDiscrepancyDescriptions;
exports.generateId = generateId;
const uuid_1 = require("uuid");
var SampleStatus;
(function (SampleStatus) {
    SampleStatus["PENDING"] = "pending";
    SampleStatus["SHIPPED"] = "shipped";
    SampleStatus["RETURNED"] = "returned";
    SampleStatus["DAMAGED"] = "damaged";
    SampleStatus["LOST"] = "lost";
    SampleStatus["OVERDUE"] = "overdue";
})(SampleStatus || (exports.SampleStatus = SampleStatus = {}));
var DiscrepancyType;
(function (DiscrepancyType) {
    DiscrepancyType["OVERDUE_NOT_RETURNED"] = "overdue_not_returned";
    DiscrepancyType["DAMAGED_DEDUCTION"] = "damaged_deduction";
    DiscrepancyType["DUPLICATE_SHIPMENT"] = "duplicate_shipment";
    DiscrepancyType["MANUAL_CORRECTION"] = "manual_correction";
})(DiscrepancyType || (exports.DiscrepancyType = DiscrepancyType = {}));
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING_REVIEW"] = "pending_review";
    ReviewStatus["REVIEWED"] = "reviewed";
    ReviewStatus["CONFIRMED"] = "confirmed";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
function getPrimaryDiscrepancy(record) {
    return record.discrepancies.length > 0 ? record.discrepancies[0] : undefined;
}
function getAllDiscrepancyTypes(record) {
    return record.discrepancies.map(d => d.type).join('; ');
}
function getAllDiscrepancyDescriptions(record) {
    return record.discrepancies.map(d => d.description).join(' | ');
}
function generateId() {
    return (0, uuid_1.v4)();
}
