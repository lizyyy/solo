"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSource = exports.ReviewReason = exports.RecordStatus = void 0;
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING_IMPORT"] = "pending_import";
    RecordStatus["IMPORTED"] = "imported";
    RecordStatus["MATCHED"] = "matched";
    RecordStatus["NEEDS_REVIEW"] = "needs_review";
    RecordStatus["CONFIRMED"] = "confirmed";
    RecordStatus["REJECTED"] = "rejected";
    RecordStatus["SUPERSEDED"] = "superseded";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var ReviewReason;
(function (ReviewReason) {
    ReviewReason["TEMP_SUBSTITUTE_ONLY_IN_GROUP"] = "temp_substitute_only_in_group";
    ReviewReason["CONTRACT_MISSING"] = "contract_missing";
    ReviewReason["GROUP_RECORD_MISSING"] = "group_record_missing";
    ReviewReason["INFO_MISMATCH"] = "info_mismatch";
    ReviewReason["MANUAL_REVIEW_REQUIRED"] = "manual_review_required";
})(ReviewReason || (exports.ReviewReason = ReviewReason = {}));
var DataSource;
(function (DataSource) {
    DataSource["GROUP_SIGNUP"] = "group_signup";
    DataSource["CONTRACT_SCREENSHOT"] = "contract_screenshot";
})(DataSource || (exports.DataSource = DataSource = {}));
//# sourceMappingURL=index.js.map