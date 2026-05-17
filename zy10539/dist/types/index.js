"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExceptionType = exports.CorrectionStatus = void 0;
var CorrectionStatus;
(function (CorrectionStatus) {
    CorrectionStatus["DRAFT"] = "DRAFT";
    CorrectionStatus["PREVIEWED"] = "PREVIEWED";
    CorrectionStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    CorrectionStatus["APPROVED"] = "APPROVED";
    CorrectionStatus["EXECUTING"] = "EXECUTING";
    CorrectionStatus["COMPLETED"] = "COMPLETED";
    CorrectionStatus["REJECTED"] = "REJECTED";
    CorrectionStatus["ROLLED_BACK"] = "ROLLED_BACK";
    CorrectionStatus["EXCEPTION"] = "EXCEPTION";
})(CorrectionStatus || (exports.CorrectionStatus = CorrectionStatus = {}));
var ExceptionType;
(function (ExceptionType) {
    ExceptionType["ASSET_NOT_FOUND"] = "ASSET_NOT_FOUND";
    ExceptionType["TAG_CONFLICT"] = "TAG_CONFLICT";
    ExceptionType["COST_CALCULATION_ERROR"] = "COST_CALCULATION_ERROR";
    ExceptionType["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ExceptionType["EXECUTION_FAILED"] = "EXECUTION_FAILED";
    ExceptionType["ROLLBACK_FAILED"] = "ROLLBACK_FAILED";
})(ExceptionType || (exports.ExceptionType = ExceptionType = {}));
//# sourceMappingURL=index.js.map