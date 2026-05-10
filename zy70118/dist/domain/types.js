"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeightUnit = exports.TemperatureUnit = exports.TicketType = exports.InspectionType = exports.BatchStatus = void 0;
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["PENDING"] = "PENDING";
    BatchStatus["TEMPERATURE_CHECKED"] = "TEMPERATURE_CHECKED";
    BatchStatus["WEIGHT_CHECKED"] = "WEIGHT_CHECKED";
    BatchStatus["TICKET_CHECKED"] = "TICKET_CHECKED";
    BatchStatus["ACCEPTED"] = "ACCEPTED";
    BatchStatus["PARTIALLY_ACCEPTED"] = "PARTIALLY_ACCEPTED";
    BatchStatus["REJECTED"] = "REJECTED";
    BatchStatus["REPLENISHED"] = "REPLENISHED";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
var InspectionType;
(function (InspectionType) {
    InspectionType["TEMPERATURE"] = "TEMPERATURE";
    InspectionType["WEIGHT"] = "WEIGHT";
    InspectionType["TICKET"] = "TICKET";
})(InspectionType || (exports.InspectionType = InspectionType = {}));
var TicketType;
(function (TicketType) {
    TicketType["QUALIFICATION_CERT"] = "QUALIFICATION_CERT";
    TicketType["INSPECTION_REPORT"] = "INSPECTION_REPORT";
    TicketType["DELIVER_NOTE"] = "DELIVER_NOTE";
    TicketType["INVOICE"] = "INVOICE";
})(TicketType || (exports.TicketType = TicketType = {}));
var TemperatureUnit;
(function (TemperatureUnit) {
    TemperatureUnit["CELSIUS"] = "CELSIUS";
    TemperatureUnit["FAHRENHEIT"] = "FAHRENHEIT";
})(TemperatureUnit || (exports.TemperatureUnit = TemperatureUnit = {}));
var WeightUnit;
(function (WeightUnit) {
    WeightUnit["KILOGRAM"] = "KILOGRAM";
    WeightUnit["GRAM"] = "GRAM";
    WeightUnit["POUND"] = "POUND";
})(WeightUnit || (exports.WeightUnit = WeightUnit = {}));
//# sourceMappingURL=types.js.map