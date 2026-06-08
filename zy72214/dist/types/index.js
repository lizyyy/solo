"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeType = exports.ProcessingStatus = void 0;
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["IMPORTED"] = "IMPORTED";
    ProcessingStatus["PENDING_APPROVER_VERIFICATION"] = "PENDING_APPROVER_VERIFICATION";
    ProcessingStatus["APPROVER_VERIFIED"] = "APPROVER_VERIFIED";
    ProcessingStatus["EX_RIGHTS_DATE_REVIEWED"] = "EX_RIGHTS_DATE_REVIEWED";
    ProcessingStatus["BALANCE_UPDATED"] = "BALANCE_UPDATED";
    ProcessingStatus["NEEDS_REWORK"] = "NEEDS_REWORK";
    ProcessingStatus["ROLLBACKED"] = "ROLLBACKED";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var ChangeType;
(function (ChangeType) {
    ChangeType["CREATE"] = "CREATE";
    ChangeType["UPDATE"] = "UPDATE";
    ChangeType["DELETE"] = "DELETE";
    ChangeType["ROLLBACK"] = "ROLLBACK";
    ChangeType["STATUS_CHANGE"] = "STATUS_CHANGE";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
