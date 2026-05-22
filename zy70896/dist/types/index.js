"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueType = exports.RecordStatus = void 0;
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["NEEDS_REVIEW"] = "needs_review";
    RecordStatus["PROCESSED"] = "processed";
    RecordStatus["RETURNED"] = "returned";
    RecordStatus["APPROVED"] = "approved";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var IssueType;
(function (IssueType) {
    IssueType["AMOUNT_MISMATCH"] = "amount_mismatch";
    IssueType["MISSING_SIGNATURE"] = "missing_signature";
    IssueType["CROSS_DAY_TRANSFER"] = "cross_day_transfer";
    IssueType["MISSING_DATA"] = "missing_data";
})(IssueType || (exports.IssueType = IssueType = {}));
