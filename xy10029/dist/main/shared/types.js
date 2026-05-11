"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchStatus = exports.RetryStatus = exports.LogLevel = exports.ChangeType = exports.BorrowStatus = exports.DeviceStatusTransitions = exports.DeviceStatus = exports.DeviceCategory = exports.Permission = exports.RolePermissions = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["OPERATOR"] = "operator";
    UserRole["USER"] = "user";
})(UserRole || (exports.UserRole = UserRole = {}));
exports.RolePermissions = {
    [UserRole.ADMIN]: [
        Permission.VIEW_DEVICES,
        Permission.MANAGE_DEVICES,
        Permission.LEND_DEVICE,
        Permission.RETURN_DEVICE,
        Permission.VIEW_HISTORY,
        Permission.VIEW_LOGS,
        Permission.EXPORT_DATA,
        Permission.IMPORT_DATA,
        Permission.MANAGE_USERS,
        Permission.BATCH_OPERATIONS,
        Permission.RESTORE_VERSION,
        Permission.SYSTEM_SETTINGS
    ],
    [UserRole.OPERATOR]: [
        Permission.VIEW_DEVICES,
        Permission.LEND_DEVICE,
        Permission.RETURN_DEVICE,
        Permission.VIEW_HISTORY,
        Permission.EXPORT_DATA,
        Permission.BATCH_OPERATIONS
    ],
    [UserRole.USER]: [
        Permission.VIEW_DEVICES,
        Permission.VIEW_HISTORY
    ]
};
var Permission;
(function (Permission) {
    Permission["VIEW_DEVICES"] = "view_devices";
    Permission["MANAGE_DEVICES"] = "manage_devices";
    Permission["LEND_DEVICE"] = "lend_device";
    Permission["RETURN_DEVICE"] = "return_device";
    Permission["VIEW_HISTORY"] = "view_history";
    Permission["VIEW_LOGS"] = "view_logs";
    Permission["EXPORT_DATA"] = "export_data";
    Permission["IMPORT_DATA"] = "import_data";
    Permission["MANAGE_USERS"] = "manage_users";
    Permission["BATCH_OPERATIONS"] = "batch_operations";
    Permission["RESTORE_VERSION"] = "restore_version";
    Permission["SYSTEM_SETTINGS"] = "system_settings";
})(Permission || (exports.Permission = Permission = {}));
var DeviceCategory;
(function (DeviceCategory) {
    DeviceCategory["LAPTOP"] = "laptop";
    DeviceCategory["PHONE"] = "phone";
    DeviceCategory["TABLET"] = "tablet";
    DeviceCategory["CAMERA"] = "camera";
    DeviceCategory["AUDIO"] = "audio";
    DeviceCategory["OTHER"] = "other";
})(DeviceCategory || (exports.DeviceCategory = DeviceCategory = {}));
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["AVAILABLE"] = "available";
    DeviceStatus["BORROWED"] = "borrowed";
    DeviceStatus["MAINTENANCE"] = "maintenance";
    DeviceStatus["RESERVED"] = "reserved";
    DeviceStatus["LOST"] = "lost";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
exports.DeviceStatusTransitions = {
    [DeviceStatus.AVAILABLE]: [DeviceStatus.BORROWED, DeviceStatus.MAINTENANCE, DeviceStatus.RESERVED],
    [DeviceStatus.BORROWED]: [DeviceStatus.AVAILABLE, DeviceStatus.MAINTENANCE, DeviceStatus.LOST],
    [DeviceStatus.MAINTENANCE]: [DeviceStatus.AVAILABLE],
    [DeviceStatus.RESERVED]: [DeviceStatus.AVAILABLE, DeviceStatus.BORROWED],
    [DeviceStatus.LOST]: [DeviceStatus.AVAILABLE]
};
var BorrowStatus;
(function (BorrowStatus) {
    BorrowStatus["ACTIVE"] = "active";
    BorrowStatus["RETURNED"] = "returned";
    BorrowStatus["OVERDUE"] = "overdue";
    BorrowStatus["CANCELLED"] = "cancelled";
})(BorrowStatus || (exports.BorrowStatus = BorrowStatus = {}));
var ChangeType;
(function (ChangeType) {
    ChangeType["CREATE"] = "create";
    ChangeType["UPDATE"] = "update";
    ChangeType["BORROW"] = "borrow";
    ChangeType["RETURN"] = "return";
    ChangeType["MAINTENANCE"] = "maintenance";
    ChangeType["DELETE"] = "delete";
    ChangeType["RESTORE"] = "restore";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var RetryStatus;
(function (RetryStatus) {
    RetryStatus["PENDING"] = "pending";
    RetryStatus["RETRYING"] = "retrying";
    RetryStatus["SUCCESS"] = "success";
    RetryStatus["FAILED"] = "failed";
    RetryStatus["CANCELLED"] = "cancelled";
})(RetryStatus || (exports.RetryStatus = RetryStatus = {}));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["PENDING"] = "pending";
    BatchStatus["RUNNING"] = "running";
    BatchStatus["COMPLETED"] = "completed";
    BatchStatus["PARTIAL"] = "partial";
    BatchStatus["FAILED"] = "failed";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
//# sourceMappingURL=types.js.map