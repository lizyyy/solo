"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewFlag = exports.DataSource = exports.RecordStatus = void 0;
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING_IMPORT"] = "pending_import";
    RecordStatus["IMPORTED"] = "imported";
    RecordStatus["MATCHED"] = "matched";
    RecordStatus["NEEDS_REVIEW"] = "needs_review";
    RecordStatus["TEMP_SUBSTITUTE"] = "temp_substitute";
    RecordStatus["CONFIRMED"] = "confirmed";
    RecordStatus["SETTLED"] = "settled";
    RecordStatus["EXPORTED"] = "exported";
    RecordStatus["DUPLICATE"] = "duplicate";
    RecordStatus["ERROR"] = "error";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var DataSource;
(function (DataSource) {
    DataSource["TUNER_MESSAGE"] = "tuner_message";
    DataSource["GROUP_SIGNUP"] = "group_signup";
})(DataSource || (exports.DataSource = DataSource = {}));
var ReviewFlag;
(function (ReviewFlag) {
    ReviewFlag["NONE"] = "none";
    ReviewFlag["TEMP_SUB_ONLY_IN_GROUP"] = "temp_sub_only_in_group";
    ReviewFlag["MISMATCH"] = "mismatch";
    ReviewFlag["MANUAL_EDIT"] = "manual_edit";
})(ReviewFlag || (exports.ReviewFlag = ReviewFlag = {}));
//# sourceMappingURL=types.js.map