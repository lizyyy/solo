"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_TRANSITIONS = exports.RebindStatus = void 0;
var RebindStatus;
(function (RebindStatus) {
    RebindStatus["PENDING"] = "pending";
    RebindStatus["REVIEWING"] = "reviewing";
    RebindStatus["APPROVED"] = "approved";
    RebindStatus["COMPLETED"] = "completed";
    RebindStatus["REJECTED"] = "rejected";
    RebindStatus["EXCEPTION"] = "exception";
    RebindStatus["MANUAL_FIXED"] = "manual_fixed";
})(RebindStatus || (exports.RebindStatus = RebindStatus = {}));
exports.STATUS_TRANSITIONS = {
    [RebindStatus.PENDING]: [RebindStatus.REVIEWING, RebindStatus.REJECTED],
    [RebindStatus.REVIEWING]: [RebindStatus.APPROVED, RebindStatus.REJECTED, RebindStatus.EXCEPTION],
    [RebindStatus.APPROVED]: [RebindStatus.COMPLETED, RebindStatus.EXCEPTION],
    [RebindStatus.COMPLETED]: [RebindStatus.MANUAL_FIXED],
    [RebindStatus.REJECTED]: [RebindStatus.PENDING, RebindStatus.MANUAL_FIXED],
    [RebindStatus.EXCEPTION]: [RebindStatus.MANUAL_FIXED, RebindStatus.PENDING],
    [RebindStatus.MANUAL_FIXED]: []
};
