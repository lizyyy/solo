"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationType = exports.RecordStatus = exports.EquipmentType = void 0;
var EquipmentType;
(function (EquipmentType) {
    EquipmentType["TRUSS"] = "truss";
    EquipmentType["LIGHT"] = "light";
    EquipmentType["SCREEN"] = "screen";
})(EquipmentType || (exports.EquipmentType = EquipmentType = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["CONFIRMED"] = "confirmed";
    RecordStatus["CANCELLED"] = "cancelled";
    RecordStatus["RETURNED"] = "returned";
    RecordStatus["DAMAGED"] = "damaged";
    RecordStatus["LOST"] = "lost";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var OperationType;
(function (OperationType) {
    OperationType["IMPORT"] = "import";
    OperationType["OCCUPY"] = "occupy";
    OperationType["TRANSFER"] = "transfer";
    OperationType["RETURN"] = "return";
    OperationType["DAMAGE"] = "damage";
    OperationType["ADJUST"] = "adjust";
})(OperationType || (exports.OperationType = OperationType = {}));
