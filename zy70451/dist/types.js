"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordStatus = exports.ServiceStatus = void 0;
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus["PENDING"] = "pending";
    ServiceStatus["NORMAL"] = "normal";
    ServiceStatus["ABNORMAL"] = "abnormal";
    ServiceStatus["MANUAL_FIXED"] = "manual_fixed";
})(ServiceStatus || (exports.ServiceStatus = ServiceStatus = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["SUCCESS"] = "success";
    RecordStatus["FAILED"] = "failed";
    RecordStatus["PARTIAL_SUCCESS"] = "partial_success";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
