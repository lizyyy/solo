"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreezeType = exports.RiskLevel = exports.TransferStatus = exports.CollectionStatus = void 0;
var CollectionStatus;
(function (CollectionStatus) {
    CollectionStatus["NORMAL"] = "normal";
    CollectionStatus["FROZEN"] = "frozen";
    CollectionStatus["TRANSFERRING"] = "transferring";
})(CollectionStatus || (exports.CollectionStatus = CollectionStatus = {}));
var TransferStatus;
(function (TransferStatus) {
    TransferStatus["PENDING"] = "pending";
    TransferStatus["COMPLETED"] = "completed";
    TransferStatus["REJECTED"] = "rejected";
    TransferStatus["CANCELED"] = "canceled";
    TransferStatus["REVOKED"] = "revoked";
})(TransferStatus || (exports.TransferStatus = TransferStatus = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var FreezeType;
(function (FreezeType) {
    FreezeType["USER"] = "user";
    FreezeType["COLLECTION"] = "collection";
})(FreezeType || (exports.FreezeType = FreezeType = {}));
//# sourceMappingURL=types.js.map