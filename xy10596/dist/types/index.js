"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RejectReason = exports.SurveyStatus = void 0;
var SurveyStatus;
(function (SurveyStatus) {
    SurveyStatus["PENDING"] = "pending";
    SurveyStatus["VALID"] = "valid";
    SurveyStatus["REJECTED"] = "rejected";
    SurveyStatus["OVER_QUOTA"] = "over_quota";
    SurveyStatus["NEEDS_REVIEW"] = "needs_review";
    SurveyStatus["MANUALLY_RESERVED"] = "manually_reserved";
    SurveyStatus["MANUALLY_REJECTED"] = "manually_rejected";
})(SurveyStatus || (exports.SurveyStatus = SurveyStatus = {}));
var RejectReason;
(function (RejectReason) {
    RejectReason["DUPLICATE_PHONE"] = "duplicate_phone";
    RejectReason["TOO_FAST"] = "too_fast";
    RejectReason["ALL_SAME_OPTIONS"] = "all_same_options";
    RejectReason["OVER_QUOTA"] = "over_quota";
    RejectReason["MANUAL_REJECT"] = "manual_reject";
})(RejectReason || (exports.RejectReason = RejectReason = {}));
