"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepairType = exports.TransactionType = exports.AssetStatus = exports.AssetCategory = void 0;
var AssetCategory;
(function (AssetCategory) {
    AssetCategory["FREEZER"] = "FREEZER";
    AssetCategory["CASH_REGISTER"] = "CASH_REGISTER";
    AssetCategory["COFFEE_MACHINE"] = "COFFEE_MACHINE";
})(AssetCategory || (exports.AssetCategory = AssetCategory = {}));
var AssetStatus;
(function (AssetStatus) {
    AssetStatus["ACTIVE"] = "ACTIVE";
    AssetStatus["REPAIRING"] = "REPAIRING";
    AssetStatus["SCRAPPED"] = "SCRAPPED";
})(AssetStatus || (exports.AssetStatus = AssetStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["ACQUISITION"] = "ACQUISITION";
    TransactionType["TRANSFER"] = "TRANSFER";
    TransactionType["REPAIR"] = "REPAIR";
    TransactionType["SCRAP"] = "SCRAP";
    TransactionType["DEPRECIATION"] = "DEPRECIATION";
    TransactionType["CORRECTION"] = "CORRECTION";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var RepairType;
(function (RepairType) {
    RepairType["ROUTINE"] = "ROUTINE";
    RepairType["CAPITALIZED"] = "CAPITALIZED";
})(RepairType || (exports.RepairType = RepairType = {}));
//# sourceMappingURL=index.js.map