"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["RUNNING"] = "RUNNING";
    TaskStatus["FUSED"] = "FUSED";
    TaskStatus["RECOVERY_APPLY"] = "RECOVERY_APPLY";
    TaskStatus["RECOVERED"] = "RECOVERED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["FUSE"] = "FUSE";
    AuditAction["APPLY_RECOVERY"] = "APPLY_RECOVERY";
    AuditAction["APPROVE_RECOVERY"] = "APPROVE_RECOVERY";
    AuditAction["REJECT_RECOVERY"] = "REJECT_RECOVERY";
    AuditAction["WITHDRAW"] = "WITHDRAW";
    AuditAction["RECOVER"] = "RECOVER";
    AuditAction["MANUAL_REMARK"] = "MANUAL_REMARK";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
