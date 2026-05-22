"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionLevel = exports.CheckStatus = exports.RecordStatus = exports.DataSourceType = void 0;
var DataSourceType;
(function (DataSourceType) {
    DataSourceType["ORDER"] = "order";
    DataSourceType["LOSS"] = "loss";
    DataSourceType["PRICE"] = "price";
    DataSourceType["PHOTO"] = "photo";
})(DataSourceType || (exports.DataSourceType = DataSourceType = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["IMPORTED"] = "imported";
    RecordStatus["CHECKING"] = "checking";
    RecordStatus["VALID"] = "valid";
    RecordStatus["INVALID"] = "invalid";
    RecordStatus["FIXING"] = "fixing";
    RecordStatus["FIXED"] = "fixed";
    RecordStatus["REIMPORTED"] = "reimported";
    RecordStatus["EXPORTED"] = "exported";
    RecordStatus["ARCHIVED"] = "archived";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var CheckStatus;
(function (CheckStatus) {
    CheckStatus["PASS"] = "pass";
    CheckStatus["WARNING"] = "warning";
    CheckStatus["FAIL"] = "fail";
    CheckStatus["SKIPPED"] = "skipped";
})(CheckStatus || (exports.CheckStatus = CheckStatus = {}));
var PermissionLevel;
(function (PermissionLevel) {
    PermissionLevel["VIEWER"] = "viewer";
    PermissionLevel["OPERATOR"] = "operator";
    PermissionLevel["MANAGER"] = "manager";
    PermissionLevel["ADMIN"] = "admin";
})(PermissionLevel || (exports.PermissionLevel = PermissionLevel = {}));
