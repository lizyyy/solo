"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrecheckWarningType = exports.RecordStatus = exports.BatchStatus = void 0;
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["CREATED"] = "created";
    BatchStatus["PRECHECKING"] = "prechecking";
    BatchStatus["PRECHECKED"] = "prechecked";
    BatchStatus["IMPORTING"] = "importing";
    BatchStatus["PARTIALLY_COMPLETED"] = "partially_completed";
    BatchStatus["COMPLETED"] = "completed";
    BatchStatus["REVOKING"] = "revoking";
    BatchStatus["PARTIALLY_REVOKED"] = "partially_revoked";
    BatchStatus["REVOKED"] = "revoked";
    BatchStatus["FAILED"] = "failed";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["CREATED"] = "created";
    RecordStatus["UPDATED"] = "updated";
    RecordStatus["SKIPPED"] = "skipped";
    RecordStatus["FAILED"] = "failed";
    RecordStatus["REVOKING"] = "revoking";
    RecordStatus["REVOKED"] = "revoked";
    RecordStatus["REVOKE_FAILED"] = "revoke_failed";
    RecordStatus["NOT_REVOCABLE"] = "not_revocable";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var PrecheckWarningType;
(function (PrecheckWarningType) {
    PrecheckWarningType["USER_EXISTS"] = "user_exists";
    PrecheckWarningType["ROLE_NOT_FOUND"] = "role_not_found";
    PrecheckWarningType["DEPARTMENT_NOT_FOUND"] = "department_not_found";
    PrecheckWarningType["DUPLICATE_EMAIL"] = "duplicate_email";
    PrecheckWarningType["INVALID_DATA"] = "invalid_data";
})(PrecheckWarningType || (exports.PrecheckWarningType = PrecheckWarningType = {}));
