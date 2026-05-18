"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewResult = exports.ChangeType = exports.QuoteStatus = void 0;
var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["DRAFT"] = "DRAFT";
    QuoteStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    QuoteStatus["CUSTOMER_ACCEPTED"] = "CUSTOMER_ACCEPTED";
    QuoteStatus["PENDING_SUPPLEMENT"] = "PENDING_SUPPLEMENT";
    QuoteStatus["REJECTED"] = "REJECTED";
    QuoteStatus["COMPLETED"] = "COMPLETED";
    QuoteStatus["CANCELLED"] = "CANCELLED";
})(QuoteStatus || (exports.QuoteStatus = QuoteStatus = {}));
var ChangeType;
(function (ChangeType) {
    ChangeType["HIDDEN_FAULT_ADD"] = "HIDDEN_FAULT_ADD";
    ChangeType["PRICE_ADJUSTMENT"] = "PRICE_ADJUSTMENT";
    ChangeType["PART_CHANGE"] = "PART_CHANGE";
    ChangeType["LABOR_ADJUSTMENT"] = "LABOR_ADJUSTMENT";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
var ReviewResult;
(function (ReviewResult) {
    ReviewResult["PENDING"] = "PENDING";
    ReviewResult["APPROVED"] = "APPROVED";
    ReviewResult["REJECTED"] = "REJECTED";
})(ReviewResult || (exports.ReviewResult = ReviewResult = {}));
