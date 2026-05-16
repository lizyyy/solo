"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanEngine = exports.IsolationAction = exports.RiskLevel = exports.ScanStatus = void 0;
var ScanStatus;
(function (ScanStatus) {
    ScanStatus["PENDING"] = "pending";
    ScanStatus["QUEUED"] = "queued";
    ScanStatus["SCANNING"] = "scanning";
    ScanStatus["SUCCESS"] = "success";
    ScanStatus["FAILED"] = "failed";
    ScanStatus["ISOLATED"] = "isolated";
    ScanStatus["MANUAL_REVIEW"] = "manual_review";
    ScanStatus["RELEASED"] = "released";
})(ScanStatus || (exports.ScanStatus = ScanStatus = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["SAFE"] = "safe";
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
    RiskLevel["CRITICAL"] = "critical";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var IsolationAction;
(function (IsolationAction) {
    IsolationAction["NONE"] = "none";
    IsolationAction["QUARANTINE"] = "quarantine";
    IsolationAction["DELETE"] = "delete";
    IsolationAction["HOLD"] = "hold";
})(IsolationAction || (exports.IsolationAction = IsolationAction = {}));
var ScanEngine;
(function (ScanEngine) {
    ScanEngine["CLAMAV"] = "clamav";
    ScanEngine["WINDOWS_DEFENDER"] = "windows_defender";
    ScanEngine["MCCAFE"] = "mccafe";
    ScanEngine["KASPERSKY"] = "kaspersky";
})(ScanEngine || (exports.ScanEngine = ScanEngine = {}));
