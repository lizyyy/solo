"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalStatus = exports.FilingStatus = void 0;
var FilingStatus;
(function (FilingStatus) {
    FilingStatus["PENDING"] = "pending";
    FilingStatus["CONFIRMED"] = "confirmed";
    FilingStatus["BLOCKED"] = "blocked";
    FilingStatus["REVOKED"] = "revoked";
    FilingStatus["COMPENSATED"] = "compensated";
    FilingStatus["CLOSED"] = "closed";
    FilingStatus["EXPIRED"] = "expired";
})(FilingStatus || (exports.FilingStatus = FilingStatus = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["REJECTED"] = "rejected";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
