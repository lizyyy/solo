"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifferenceType = exports.ReviewAction = exports.ItemStatus = exports.RecordSource = void 0;
var RecordSource;
(function (RecordSource) {
    RecordSource["PASSENGER"] = "passenger";
    RecordSource["DRIVER"] = "driver";
    RecordSource["WAREHOUSE"] = "warehouse";
})(RecordSource || (exports.RecordSource = RecordSource = {}));
var ItemStatus;
(function (ItemStatus) {
    ItemStatus["PENDING"] = "pending";
    ItemStatus["MATCHED"] = "matched";
    ItemStatus["UNMATCHED"] = "unmatched";
    ItemStatus["REVIEWING"] = "reviewing";
    ItemStatus["APPROVED"] = "approved";
    ItemStatus["REJECTED"] = "rejected";
    ItemStatus["RETURNED"] = "returned";
    ItemStatus["CLAIMED"] = "claimed";
    ItemStatus["OVERDUE"] = "overdue";
})(ItemStatus || (exports.ItemStatus = ItemStatus = {}));
var ReviewAction;
(function (ReviewAction) {
    ReviewAction["APPROVE"] = "approve";
    ReviewAction["REJECT"] = "reject";
    ReviewAction["REQUEST_MORE_INFO"] = "request_more_info";
    ReviewAction["MANUAL_MATCH"] = "manual_match";
    ReviewAction["UNMATCH"] = "unmatch";
})(ReviewAction || (exports.ReviewAction = ReviewAction = {}));
var DifferenceType;
(function (DifferenceType) {
    DifferenceType["SAME_NAME"] = "same_name";
    DifferenceType["OVERDUE"] = "overdue";
    DifferenceType["SENSITIVE_INFO"] = "sensitive_info";
    DifferenceType["DESCRIPTION_MISMATCH"] = "description_mismatch";
    DifferenceType["TIME_MISMATCH"] = "time_mismatch";
    DifferenceType["LOCATION_MISMATCH"] = "location_mismatch";
    DifferenceType["DUPLICATE"] = "duplicate";
})(DifferenceType || (exports.DifferenceType = DifferenceType = {}));
