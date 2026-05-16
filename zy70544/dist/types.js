"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasonCategory = exports.RecalculationStatus = void 0;
var RecalculationStatus;
(function (RecalculationStatus) {
    RecalculationStatus["DRAFT"] = "DRAFT";
    RecalculationStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    RecalculationStatus["APPROVED"] = "APPROVED";
    RecalculationStatus["PROCESSING"] = "PROCESSING";
    RecalculationStatus["COMPLETED"] = "COMPLETED";
    RecalculationStatus["REJECTED"] = "REJECTED";
    RecalculationStatus["FAILED"] = "FAILED";
    RecalculationStatus["NEEDS_MANUAL_CORRECTION"] = "NEEDS_MANUAL_CORRECTION";
})(RecalculationStatus || (exports.RecalculationStatus = RecalculationStatus = {}));
var ReasonCategory;
(function (ReasonCategory) {
    ReasonCategory["PRICE_ADJUSTMENT"] = "PRICE_ADJUSTMENT";
    ReasonCategory["QUANTITY_CORRECTION"] = "QUANTITY_CORRECTION";
    ReasonCategory["DISCOUNT_APPLICATION"] = "DISCOUNT_APPLICATION";
    ReasonCategory["TAX_RECALCULATION"] = "TAX_RECALCULATION";
    ReasonCategory["SYSTEM_ERROR"] = "SYSTEM_ERROR";
    ReasonCategory["CUSTOMER_REQUEST"] = "CUSTOMER_REQUEST";
    ReasonCategory["OTHER"] = "OTHER";
})(ReasonCategory || (exports.ReasonCategory = ReasonCategory = {}));
