"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStatus = exports.ProcessingStatus = exports.InitStep = void 0;
var InitStep;
(function (InitStep) {
    InitStep["VALIDATE_PACKAGE"] = "VALIDATE_PACKAGE";
    InitStep["EXTRACT_FILES"] = "EXTRACT_FILES";
    InitStep["PARSE_METADATA"] = "PARSE_METADATA";
    InitStep["CREATE_TENANT"] = "CREATE_TENANT";
    InitStep["IMPORT_DEVICES"] = "IMPORT_DEVICES";
    InitStep["CONFIGURE_PERMISSIONS"] = "CONFIGURE_PERMISSIONS";
    InitStep["FINALIZE"] = "FINALIZE";
})(InitStep || (exports.InitStep = InitStep = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["PENDING"] = "PENDING";
    ProcessingStatus["PROCESSING"] = "PROCESSING";
    ProcessingStatus["SUCCESS"] = "SUCCESS";
    ProcessingStatus["PARTIAL_SUCCESS"] = "PARTIAL_SUCCESS";
    ProcessingStatus["FAILED"] = "FAILED";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var ItemStatus;
(function (ItemStatus) {
    ItemStatus["PENDING"] = "PENDING";
    ItemStatus["SUCCESS"] = "SUCCESS";
    ItemStatus["FAILED"] = "FAILED";
    ItemStatus["SKIPPED"] = "SKIPPED";
})(ItemStatus || (exports.ItemStatus = ItemStatus = {}));
