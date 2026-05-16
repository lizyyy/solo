"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainResultPolicy = exports.TaskExecutionStatus = exports.CancelRequestStatus = void 0;
var CancelRequestStatus;
(function (CancelRequestStatus) {
    CancelRequestStatus["PENDING"] = "PENDING";
    CancelRequestStatus["CONFIRMED"] = "CONFIRMED";
    CancelRequestStatus["INTERCEPTED"] = "INTERCEPTED";
    CancelRequestStatus["CANCELED"] = "CANCELED";
    CancelRequestStatus["COMPENSATED"] = "COMPENSATED";
})(CancelRequestStatus || (exports.CancelRequestStatus = CancelRequestStatus = {}));
var TaskExecutionStatus;
(function (TaskExecutionStatus) {
    TaskExecutionStatus["PENDING"] = "PENDING";
    TaskExecutionStatus["RUNNING"] = "RUNNING";
    TaskExecutionStatus["COMPLETED"] = "COMPLETED";
    TaskExecutionStatus["FAILED"] = "FAILED";
    TaskExecutionStatus["CANCELED"] = "CANCELED";
})(TaskExecutionStatus || (exports.TaskExecutionStatus = TaskExecutionStatus = {}));
var RetainResultPolicy;
(function (RetainResultPolicy) {
    RetainResultPolicy["ALL"] = "ALL";
    RetainResultPolicy["NONE"] = "NONE";
    RetainResultPolicy["PARTIAL"] = "PARTIAL";
})(RetainResultPolicy || (exports.RetainResultPolicy = RetainResultPolicy = {}));
//# sourceMappingURL=index.js.map