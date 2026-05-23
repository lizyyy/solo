"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordStatus = exports.TaskStatus = exports.ImportStrategy = exports.DataSourceType = void 0;
var DataSourceType;
(function (DataSourceType) {
    DataSourceType["VISITOR_APPOINTMENT"] = "visitor_appointment";
    DataSourceType["GATE_RECORD"] = "gate_record";
    DataSourceType["TEMP_PLATE"] = "temp_plate";
    DataSourceType["REFUND_FLOW"] = "refund_flow";
})(DataSourceType || (exports.DataSourceType = DataSourceType = {}));
var ImportStrategy;
(function (ImportStrategy) {
    ImportStrategy["IGNORE"] = "ignore";
    ImportStrategy["OVERWRITE"] = "overwrite";
    ImportStrategy["APPEND"] = "append";
})(ImportStrategy || (exports.ImportStrategy = ImportStrategy = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["PROCESSING"] = "processing";
    TaskStatus["RETRY"] = "retry";
    TaskStatus["MANUAL"] = "manual";
    TaskStatus["PERMANENT_FAILED"] = "permanent_failed";
    TaskStatus["COMPLETED"] = "completed";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["RAW"] = "raw";
    RecordStatus["VALID"] = "valid";
    RecordStatus["INVALID"] = "invalid";
    RecordStatus["FIXED"] = "fixed";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
