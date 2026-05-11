"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationType = exports.ReissueStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["CUSTOMER_SERVICE"] = "customer_service";
    UserRole["NORMAL"] = "normal";
})(UserRole || (exports.UserRole = UserRole = {}));
var ReissueStatus;
(function (ReissueStatus) {
    ReissueStatus["PENDING"] = "pending";
    ReissueStatus["PROCESSING"] = "processing";
    ReissueStatus["SHIPPED"] = "shipped";
    ReissueStatus["DELIVERED"] = "delivered";
    ReissueStatus["COMPLETED"] = "completed";
    ReissueStatus["CANCELLED"] = "cancelled";
    ReissueStatus["FAILED"] = "failed";
})(ReissueStatus || (exports.ReissueStatus = ReissueStatus = {}));
var OperationType;
(function (OperationType) {
    OperationType["CREATE"] = "create";
    OperationType["UPDATE"] = "update";
    OperationType["STATUS_CHANGE"] = "status_change";
    OperationType["DELETE"] = "delete";
    OperationType["IMPORT"] = "import";
    OperationType["EXPORT"] = "export";
    OperationType["RETRY"] = "retry";
    OperationType["LOGIN"] = "login";
    OperationType["LOGOUT"] = "logout";
})(OperationType || (exports.OperationType = OperationType = {}));
