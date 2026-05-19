"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingResult = exports.RecordStatus = exports.FaultType = void 0;
var FaultType;
(function (FaultType) {
    FaultType["CABINET_DOOR_FAILED"] = "\u67DC\u95E8\u6253\u4E0D\u5F00";
    FaultType["SCAN_FAILED"] = "\u626B\u7801\u5931\u8D25";
    FaultType["EMPTY_BIN_FALSE_ALARM"] = "\u7A7A\u4ED3\u8BEF\u62A5";
    FaultType["OTHER"] = "\u5176\u4ED6";
})(FaultType || (exports.FaultType = FaultType = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "\u5F85\u5904\u7406";
    RecordStatus["PROCESSING"] = "\u5904\u7406\u4E2D";
    RecordStatus["RESOLVED"] = "\u5DF2\u89E3\u51B3";
    RecordStatus["REJECTED"] = "\u5DF2\u9A73\u56DE";
    RecordStatus["MERGED"] = "\u5DF2\u5408\u5E76";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var ProcessingResult;
(function (ProcessingResult) {
    ProcessingResult["ALLOWED"] = "\u653E\u884C";
    ProcessingResult["BLOCKED"] = "\u62E6\u622A";
})(ProcessingResult || (exports.ProcessingResult = ProcessingResult = {}));
