"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaStatus = exports.RejectReason = exports.QuotaWindow = void 0;
var QuotaWindow;
(function (QuotaWindow) {
    QuotaWindow["DAILY"] = "daily";
    QuotaWindow["WEEKLY"] = "weekly";
    QuotaWindow["MONTHLY"] = "monthly";
})(QuotaWindow || (exports.QuotaWindow = QuotaWindow = {}));
var RejectReason;
(function (RejectReason) {
    RejectReason["QUOTA_EXHAUSTED"] = "quota_exhausted";
    RejectReason["INVALID_USAGE_TAG"] = "invalid_usage_tag";
    RejectReason["RATE_LIMIT_EXCEEDED"] = "rate_limit_exceeded";
    RejectReason["MODEL_NOT_AUTHORIZED"] = "model_not_authorized";
    RejectReason["SUSPENDED"] = "suspended";
})(RejectReason || (exports.RejectReason = RejectReason = {}));
var QuotaStatus;
(function (QuotaStatus) {
    QuotaStatus["ACTIVE"] = "active";
    QuotaStatus["SUSPENDED"] = "suspended";
    QuotaStatus["EXPIRED"] = "expired";
})(QuotaStatus || (exports.QuotaStatus = QuotaStatus = {}));
