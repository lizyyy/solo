"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConclusionToStatusMap = exports.StateTransitionRules = void 0;
exports.isValidStatusTransition = isValidStatusTransition;
exports.canBeReviewed = canBeReviewed;
exports.isFinalStatus = isFinalStatus;
const types_1 = require("../types");
exports.StateTransitionRules = {
    [types_1.RefundReviewStatus.PENDING_REFUND]: [
        types_1.RefundReviewStatus.INTERCEPTING,
        types_1.RefundReviewStatus.APPROVED
    ],
    [types_1.RefundReviewStatus.INTERCEPTING]: [
        types_1.RefundReviewStatus.APPROVED,
        types_1.RefundReviewStatus.REJECTED,
        types_1.RefundReviewStatus.PENDING_REFUND
    ],
    [types_1.RefundReviewStatus.APPROVED]: [],
    [types_1.RefundReviewStatus.REJECTED]: []
};
exports.ConclusionToStatusMap = {
    [types_1.ReviewConclusion.MANUAL_APPROVE]: types_1.RefundReviewStatus.APPROVED,
    [types_1.ReviewConclusion.MANUAL_REJECT]: types_1.RefundReviewStatus.REJECTED,
    [types_1.ReviewConclusion.AUTO_APPROVE]: types_1.RefundReviewStatus.APPROVED,
    [types_1.ReviewConclusion.AUTO_REJECT]: types_1.RefundReviewStatus.REJECTED
};
function isValidStatusTransition(currentStatus, targetStatus) {
    const allowedTransitions = exports.StateTransitionRules[currentStatus];
    return allowedTransitions.includes(targetStatus);
}
function canBeReviewed(status) {
    return status === types_1.RefundReviewStatus.INTERCEPTING || status === types_1.RefundReviewStatus.PENDING_REFUND;
}
function isFinalStatus(status) {
    return status === types_1.RefundReviewStatus.APPROVED || status === types_1.RefundReviewStatus.REJECTED;
}
