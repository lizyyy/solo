"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThawJobStatus = exports.TaskStatus = exports.LifecycleAction = exports.StorageClass = void 0;
var StorageClass;
(function (StorageClass) {
    StorageClass["STANDARD"] = "STANDARD";
    StorageClass["INFREQUENT_ACCESS"] = "INFREQUENT_ACCESS";
    StorageClass["ARCHIVE"] = "ARCHIVE";
    StorageClass["DEEP_ARCHIVE"] = "DEEP_ARCHIVE";
})(StorageClass || (exports.StorageClass = StorageClass = {}));
var LifecycleAction;
(function (LifecycleAction) {
    LifecycleAction["TRANSITION"] = "TRANSITION";
    LifecycleAction["DELETE"] = "DELETE";
})(LifecycleAction || (exports.LifecycleAction = LifecycleAction = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "PENDING";
    TaskStatus["RUNNING"] = "RUNNING";
    TaskStatus["SUCCESS"] = "SUCCESS";
    TaskStatus["FAILED"] = "FAILED";
    TaskStatus["RETRY_PENDING"] = "RETRY_PENDING";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var ThawJobStatus;
(function (ThawJobStatus) {
    ThawJobStatus["PENDING"] = "PENDING";
    ThawJobStatus["RESTORING"] = "RESTORING";
    ThawJobStatus["COMPLETED"] = "COMPLETED";
    ThawJobStatus["EXPIRED"] = "EXPIRED";
    ThawJobStatus["FAILED"] = "FAILED";
    ThawJobStatus["RETRY_PENDING"] = "RETRY_PENDING";
})(ThawJobStatus || (exports.ThawJobStatus = ThawJobStatus = {}));
