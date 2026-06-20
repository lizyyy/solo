"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfCheckType = exports.ReviewStatus = void 0;
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "pending";
    ReviewStatus["CONFLICT"] = "conflict";
    ReviewStatus["CONFIRMED"] = "confirmed";
    ReviewStatus["REJECTED"] = "rejected";
    ReviewStatus["NEED_ALGORITHM_REVIEW"] = "need_algorithm_review";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
var SelfCheckType;
(function (SelfCheckType) {
    SelfCheckType["DUPLICATE_IMPORT"] = "duplicate_import";
    SelfCheckType["PHONE_LEAKED"] = "phone_leaked";
    SelfCheckType["RECALC_NEEDED"] = "recalc_needed";
    SelfCheckType["EXPORT_INCONSISTENT"] = "export_inconsistent";
})(SelfCheckType || (exports.SelfCheckType = SelfCheckType = {}));
