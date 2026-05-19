"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExceptionType = exports.ShiftType = exports.TaskStatus = exports.ChargerStatus = exports.VehicleStatus = void 0;
var VehicleStatus;
(function (VehicleStatus) {
    VehicleStatus["AVAILABLE"] = "available";
    VehicleStatus["IN_USE"] = "in_use";
    VehicleStatus["CHARGING"] = "charging";
    VehicleStatus["MAINTENANCE"] = "maintenance";
})(VehicleStatus || (exports.VehicleStatus = VehicleStatus = {}));
var ChargerStatus;
(function (ChargerStatus) {
    ChargerStatus["AVAILABLE"] = "available";
    ChargerStatus["OCCUPIED"] = "occupied";
    ChargerStatus["MAINTENANCE"] = "maintenance";
})(ChargerStatus || (exports.ChargerStatus = ChargerStatus = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["ASSIGNED"] = "assigned";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["CANCELLED"] = "cancelled";
    TaskStatus["EXCEPTION"] = "exception";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var ShiftType;
(function (ShiftType) {
    ShiftType["NIGHT"] = "night";
    ShiftType["DAY"] = "day";
})(ShiftType || (exports.ShiftType = ShiftType = {}));
var ExceptionType;
(function (ExceptionType) {
    ExceptionType["LOW_BATTERY"] = "low_battery";
    ExceptionType["CHARGER_CONFLICT"] = "charger_conflict";
    ExceptionType["VEHICLE_BREAKDOWN"] = "vehicle_breakdown";
    ExceptionType["TASK_DELAY"] = "task_delay";
    ExceptionType["OPERATOR_ABSENT"] = "operator_absent";
})(ExceptionType || (exports.ExceptionType = ExceptionType = {}));
