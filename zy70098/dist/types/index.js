"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementStatus = exports.ExecutionStatus = exports.EnrollmentStatus = exports.InvitationBatchStatus = void 0;
var InvitationBatchStatus;
(function (InvitationBatchStatus) {
    InvitationBatchStatus["DRAFT"] = "draft";
    InvitationBatchStatus["PUBLISHED"] = "published";
    InvitationBatchStatus["ENROLLMENT_STARTED"] = "enrollment_started";
    InvitationBatchStatus["ENROLLMENT_CLOSED"] = "enrollment_closed";
    InvitationBatchStatus["EXECUTION_STARTED"] = "execution_started";
    InvitationBatchStatus["EXECUTION_COMPLETED"] = "execution_completed";
    InvitationBatchStatus["SETTLEMENT_STARTED"] = "settlement_started";
    InvitationBatchStatus["SETTLEMENT_COMPLETED"] = "settlement_completed";
    InvitationBatchStatus["CANCELLED"] = "cancelled";
})(InvitationBatchStatus || (exports.InvitationBatchStatus = InvitationBatchStatus = {}));
var EnrollmentStatus;
(function (EnrollmentStatus) {
    EnrollmentStatus["PENDING_REVIEW"] = "pending_review";
    EnrollmentStatus["APPROVED"] = "approved";
    EnrollmentStatus["REJECTED"] = "rejected";
    EnrollmentStatus["CANCELLED"] = "cancelled";
})(EnrollmentStatus || (exports.EnrollmentStatus = EnrollmentStatus = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["NOT_STARTED"] = "not_started";
    ExecutionStatus["IN_PROGRESS"] = "in_progress";
    ExecutionStatus["COMPLETED"] = "completed";
    ExecutionStatus["FAILED"] = "failed";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var SettlementStatus;
(function (SettlementStatus) {
    SettlementStatus["PENDING"] = "pending";
    SettlementStatus["IN_PROGRESS"] = "in_progress";
    SettlementStatus["COMPLETED"] = "completed";
    SettlementStatus["FAILED"] = "failed";
})(SettlementStatus || (exports.SettlementStatus = SettlementStatus = {}));
//# sourceMappingURL=index.js.map