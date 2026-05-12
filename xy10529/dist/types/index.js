"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationType = exports.FreezeReason = exports.BenefitStatus = void 0;
var BenefitStatus;
(function (BenefitStatus) {
    BenefitStatus["ACTIVE"] = "active";
    BenefitStatus["FROZEN"] = "frozen";
    BenefitStatus["REFUNDED"] = "refunded";
    BenefitStatus["EXPIRED"] = "expired";
    BenefitStatus["COMPENSATED"] = "compensated";
    BenefitStatus["INVALID"] = "invalid";
})(BenefitStatus || (exports.BenefitStatus = BenefitStatus = {}));
var FreezeReason;
(function (FreezeReason) {
    FreezeReason["REFUND"] = "refund";
    FreezeReason["RISK_CONTROL"] = "risk_control";
    FreezeReason["MANUAL"] = "manual";
    FreezeReason["OTHER"] = "other";
})(FreezeReason || (exports.FreezeReason = FreezeReason = {}));
var OperationType;
(function (OperationType) {
    OperationType["CREATE_MEMBER"] = "create_member";
    OperationType["GRANT_BENEFIT"] = "grant_benefit";
    OperationType["FREEZE"] = "freeze";
    OperationType["UNFREEZE"] = "unfreeze";
    OperationType["REFUND"] = "refund";
    OperationType["COMPENSATE"] = "compensate";
    OperationType["MANUAL_CORRECT"] = "manual_correct";
    OperationType["EXPIRE"] = "expire";
    OperationType["QUERY"] = "query";
})(OperationType || (exports.OperationType = OperationType = {}));
//# sourceMappingURL=index.js.map