"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchActionType = exports.ChangeSource = exports.SubmissionStatus = void 0;
var SubmissionStatus;
(function (SubmissionStatus) {
    SubmissionStatus["PENDING"] = "pending";
    SubmissionStatus["APPROVED"] = "approved";
    SubmissionStatus["REJECTED"] = "rejected";
    SubmissionStatus["ATTACHMENT_EXPIRED"] = "attachment_expired";
})(SubmissionStatus || (exports.SubmissionStatus = SubmissionStatus = {}));
var ChangeSource;
(function (ChangeSource) {
    ChangeSource["USER"] = "user";
    ChangeSource["SYSTEM"] = "system";
    ChangeSource["BATCH"] = "batch";
    ChangeSource["CERTIFICATE_ISSUE"] = "certificate_issue";
})(ChangeSource || (exports.ChangeSource = ChangeSource = {}));
var BatchActionType;
(function (BatchActionType) {
    BatchActionType["APPROVE"] = "approve";
    BatchActionType["REJECT"] = "reject";
    BatchActionType["REPROCESS"] = "reprocess";
})(BatchActionType || (exports.BatchActionType = BatchActionType = {}));
//# sourceMappingURL=types.js.map