"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbnormalType = exports.ProcessingStatus = void 0;
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["SUCCESS"] = "success";
    ProcessingStatus["ABNORMAL"] = "abnormal";
    ProcessingStatus["PENDING"] = "pending";
    ProcessingStatus["MANUALLY_CORRECTED"] = "manually_corrected";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var AbnormalType;
(function (AbnormalType) {
    AbnormalType["FIELD_TRUNCATED"] = "field_truncated";
    AbnormalType["DATA_MISSING"] = "data_missing";
    AbnormalType["FORMAT_ERROR"] = "format_error";
    AbnormalType["DUPLICATE"] = "duplicate";
})(AbnormalType || (exports.AbnormalType = AbnormalType = {}));
