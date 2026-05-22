"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailReason = exports.MatchStatus = exports.RecordSource = void 0;
var RecordSource;
(function (RecordSource) {
    RecordSource["PASSENGER"] = "passenger";
    RecordSource["DRIVER"] = "driver";
    RecordSource["WAREHOUSE"] = "warehouse";
})(RecordSource || (exports.RecordSource = RecordSource = {}));
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["NORMAL"] = "normal";
    MatchStatus["PENDING"] = "pending";
    MatchStatus["FAILED"] = "failed";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
var FailReason;
(function (FailReason) {
    FailReason["DUPLICATE_BATCH"] = "duplicate_batch";
    FailReason["SAME_NAME_ITEM"] = "same_name_item";
    FailReason["OVERDUE"] = "overdue";
    FailReason["INCOMPLETE_INFO"] = "incomplete_info";
    FailReason["MISMATCH"] = "mismatch";
    FailReason["SENSITIVE_INFO"] = "sensitive_info";
})(FailReason || (exports.FailReason = FailReason = {}));
