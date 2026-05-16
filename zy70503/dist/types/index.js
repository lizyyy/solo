"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenewalStatus = exports.LeaseStatus = void 0;
var LeaseStatus;
(function (LeaseStatus) {
    LeaseStatus["PENDING"] = "pending";
    LeaseStatus["CONFIRMED"] = "confirmed";
    LeaseStatus["BLOCKED"] = "blocked";
    LeaseStatus["REVOKED"] = "revoked";
    LeaseStatus["COMPENSATED"] = "compensated";
    LeaseStatus["EXPIRED"] = "expired";
    LeaseStatus["RECYCLED"] = "recycled";
})(LeaseStatus || (exports.LeaseStatus = LeaseStatus = {}));
var RenewalStatus;
(function (RenewalStatus) {
    RenewalStatus["PENDING"] = "pending";
    RenewalStatus["APPROVED"] = "approved";
    RenewalStatus["REJECTED"] = "rejected";
})(RenewalStatus || (exports.RenewalStatus = RenewalStatus = {}));
//# sourceMappingURL=index.js.map