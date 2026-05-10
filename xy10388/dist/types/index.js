"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchReason = exports.ListingStatus = exports.BookCondition = void 0;
var BookCondition;
(function (BookCondition) {
    BookCondition["NEW"] = "new";
    BookCondition["LIKE_NEW"] = "like_new";
    BookCondition["GOOD"] = "good";
    BookCondition["FAIR"] = "fair";
    BookCondition["POOR"] = "poor";
})(BookCondition || (exports.BookCondition = BookCondition = {}));
var ListingStatus;
(function (ListingStatus) {
    ListingStatus["AVAILABLE"] = "available";
    ListingStatus["LOCKED"] = "locked";
    ListingStatus["SOLD"] = "sold";
    ListingStatus["CANCELLED"] = "cancelled";
})(ListingStatus || (exports.ListingStatus = ListingStatus = {}));
var MatchReason;
(function (MatchReason) {
    MatchReason["PERFECT_MATCH"] = "perfect_match";
    MatchReason["VERSION_MISMATCH"] = "version_mismatch";
    MatchReason["PRICE_OVER_BUDGET"] = "price_over_budget";
    MatchReason["CONDITION_MISMATCH"] = "condition_mismatch";
    MatchReason["LOCATION_MISMATCH"] = "location_mismatch";
    MatchReason["ALREADY_LOCKED"] = "already_locked";
})(MatchReason || (exports.MatchReason = MatchReason = {}));
