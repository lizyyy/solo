"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Department = exports.ProcessingStatus = exports.RiskType = void 0;
var RiskType;
(function (RiskType) {
    RiskType["HIGH"] = "HIGH";
    RiskType["MEDIUM"] = "MEDIUM";
    RiskType["LOW"] = "LOW";
})(RiskType || (exports.RiskType = RiskType = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["PENDING"] = "PENDING";
    ProcessingStatus["PROCESSING"] = "PROCESSING";
    ProcessingStatus["SUCCESS"] = "SUCCESS";
    ProcessingStatus["FAILED"] = "FAILED";
    ProcessingStatus["BLOCKED"] = "BLOCKED";
    ProcessingStatus["PARTIAL_SUCCESS"] = "PARTIAL_SUCCESS";
    ProcessingStatus["EARLY_TERMINATION_BLOCKED"] = "EARLY_TERMINATION_BLOCKED";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var Department;
(function (Department) {
    Department["CUSTOMER_SERVICE"] = "CUSTOMER_SERVICE";
    Department["RISK_CONTROL"] = "RISK_CONTROL";
    Department["OPERATION"] = "OPERATION";
    Department["FINANCE"] = "FINANCE";
    Department["COMPLIANCE"] = "COMPLIANCE";
})(Department || (exports.Department = Department = {}));
