"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewResult = exports.DiscrepancyStatus = exports.DepositDeductionType = exports.DiscrepancyType = exports.LicenseType = void 0;
var LicenseType;
(function (LicenseType) {
    LicenseType["BUSINESS_LICENSE"] = "BUSINESS_LICENSE";
    LicenseType["FIRE_SAFETY"] = "FIRE_SAFETY";
    LicenseType["FOOD_SAFETY"] = "FOOD_SAFETY";
    LicenseType["OTHER"] = "OTHER";
})(LicenseType || (exports.LicenseType = LicenseType = {}));
var DiscrepancyType;
(function (DiscrepancyType) {
    DiscrepancyType["LICENSE_EXPIRED"] = "LICENSE_EXPIRED";
    DiscrepancyType["TIME_CONFLICT"] = "TIME_CONFLICT";
    DiscrepancyType["DEPOSIT_DEDUCTION"] = "DEPOSIT_DEDUCTION";
    DiscrepancyType["MISSING_DOCUMENT"] = "MISSING_DOCUMENT";
    DiscrepancyType["FEE_MISMATCH"] = "FEE_MISMATCH";
    DiscrepancyType["MANUAL_REVIEW"] = "MANUAL_REVIEW";
})(DiscrepancyType || (exports.DiscrepancyType = DiscrepancyType = {}));
var DepositDeductionType;
(function (DepositDeductionType) {
    DepositDeductionType["FACILITY_DAMAGE"] = "FACILITY_DAMAGE";
    DepositDeductionType["CLEANING_FEE"] = "CLEANING_FEE";
    DepositDeductionType["OVERTIME_PENALTY"] = "OVERTIME_PENALTY";
    DepositDeductionType["VIOLATION_FINE"] = "VIOLATION_FINE";
    DepositDeductionType["OTHER"] = "OTHER";
})(DepositDeductionType || (exports.DepositDeductionType = DepositDeductionType = {}));
var DiscrepancyStatus;
(function (DiscrepancyStatus) {
    DiscrepancyStatus["PENDING"] = "PENDING";
    DiscrepancyStatus["APPROVED"] = "APPROVED";
    DiscrepancyStatus["REJECTED"] = "REJECTED";
    DiscrepancyStatus["DOCUMENTS_REQUESTED"] = "DOCUMENTS_REQUESTED";
})(DiscrepancyStatus || (exports.DiscrepancyStatus = DiscrepancyStatus = {}));
var ReviewResult;
(function (ReviewResult) {
    ReviewResult["APPROVE"] = "APPROVE";
    ReviewResult["REJECT"] = "REJECT";
    ReviewResult["REQUEST_DOCUMENTS"] = "REQUEST_DOCUMENTS";
    ReviewResult["ADJUST_AND_APPROVE"] = "ADJUST_AND_APPROVE";
})(ReviewResult || (exports.ReviewResult = ReviewResult = {}));
