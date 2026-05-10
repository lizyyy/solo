"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchStatus = exports.RiskLevel = exports.Severity = exports.VulnerabilityStatus = void 0;
var VulnerabilityStatus;
(function (VulnerabilityStatus) {
    VulnerabilityStatus["NEW"] = "NEW";
    VulnerabilityStatus["ASSIGNED"] = "ASSIGNED";
    VulnerabilityStatus["IN_PROGRESS"] = "IN_PROGRESS";
    VulnerabilityStatus["DELAYED"] = "DELAYED";
    VulnerabilityStatus["FIXED"] = "FIXED";
    VulnerabilityStatus["DEPLOYED"] = "DEPLOYED";
    VulnerabilityStatus["CLOSED"] = "CLOSED";
})(VulnerabilityStatus || (exports.VulnerabilityStatus = VulnerabilityStatus = {}));
var Severity;
(function (Severity) {
    Severity["CRITICAL"] = "CRITICAL";
    Severity["HIGH"] = "HIGH";
    Severity["MEDIUM"] = "MEDIUM";
    Severity["LOW"] = "LOW";
})(Severity || (exports.Severity = Severity = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["EXTREME"] = "EXTREME";
    RiskLevel["HIGH"] = "HIGH";
    RiskLevel["MEDIUM"] = "MEDIUM";
    RiskLevel["LOW"] = "LOW";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["PLANNED"] = "PLANNED";
    BatchStatus["IN_PROGRESS"] = "IN_PROGRESS";
    BatchStatus["DEPLOYED"] = "DEPLOYED";
    BatchStatus["CANCELLED"] = "CANCELLED";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
//# sourceMappingURL=types.js.map