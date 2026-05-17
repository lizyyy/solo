"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecycleStatus = void 0;
var RecycleStatus;
(function (RecycleStatus) {
    RecycleStatus["PENDING"] = "pending";
    RecycleStatus["IN_PROGRESS"] = "in_progress";
    RecycleStatus["COMPLETED"] = "completed";
    RecycleStatus["CANCELLED"] = "cancelled";
    RecycleStatus["EXPIRED"] = "expired";
    RecycleStatus["ERROR"] = "error";
})(RecycleStatus || (exports.RecycleStatus = RecycleStatus = {}));
